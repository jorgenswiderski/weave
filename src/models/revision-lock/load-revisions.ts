/* eslint-disable import/first */
import dotenv from 'dotenv';

dotenv.config();

import assert from 'assert';
import { Collection, Document } from 'mongodb';
import { error, log } from '../logger';
import { RevisionLock } from './revision-lock';
import { MongoCollections, getMongoDb, initPagesCollection } from '../mongo';
import { MediaWiki } from '../media-wiki/media-wiki';
import { CONFIG } from '../config';
import { MwnTokenBucket } from '../../api/mwn';

const isDryRun = process.argv.includes('--dry-run');

if (isDryRun) {
    MongoCollections.MW_PAGES = `load-revisions-dry-run-${Date.now()}`;
}

if (!CONFIG.MEDIAWIKI.USE_LOCKED_REVISIONS) {
    error('Revisions must be locked to load revisions');
    process.exit(1);
}

// Override this config value to allow the DB to be revised
CONFIG.MEDIAWIKI.USE_LOCKED_REVISIONS = false;

async function loadRevisions() {
    let exitCode = 1;
    let collection: Collection<Document> | null = null;

    try {
        const startTime = Date.now();
        const db = await getMongoDb();

        if (isDryRun) {
            initPagesCollection(db);
        }

        collection = db.collection(MongoCollections.MW_PAGES);

        const mismatches = await RevisionLock.getRevisionMismatches(collection);

        if (mismatches.length > 50) {
            log(
                `Updating ${mismatches.length} pages to a different revision...`,
            );
        }

        await Promise.all(
            mismatches.map(async ({ title, revisionId, pageId }) => {
                if (mismatches.length <= 50) {
                    log(`Updating page '${title}' to revision ${revisionId}`);
                }

                try {
                    await MediaWiki.getPage(title, revisionId, false);
                } catch (err) {
                    error(`Failed to update page '${title}' (${pageId}):`);
                    error(err);
                }
            }),
        );

        const validate = await Promise.all(
            mismatches.map(async (lock) => [
                lock,
                await collection!.findOne(lock),
            ]),
        );

        if (!validate.every(([, document]) => document)) {
            validate.forEach(([lock, document]) => {
                if (!document) {
                    error(
                        `Couldn't find a matching document when validating lock\n    ${JSON.stringify(
                            lock,
                        )}`,
                    );
                }
            });

            throw new Error(`Failed to validate all documents`);
        }

        if (CONFIG.MWN.TRACK_TOKEN_USAGE) {
            MwnTokenBucket.logUsage();
        }

        log(
            `Finished loading revision state in ${
                (Date.now() - startTime) / 1000
            }s.`,
        );

        exitCode = 0;
    } catch (err) {
        error(err);
    }

    try {
        if (isDryRun && collection) {
            assert(MongoCollections.MW_PAGES !== 'MW_PAGES');
            await collection.drop();
        }
    } catch (err) {
        error('Failed to drop temporary collection');
        error(err);
    }

    process.exit(exitCode);
}

loadRevisions();
