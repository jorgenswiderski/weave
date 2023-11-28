/* eslint-disable import/first */
import dotenv from 'dotenv';

dotenv.config();

import fs from 'fs';
import assert from 'assert';
import { error, log } from '../logger';
import { RevisionLock } from './revision-lock';
import { MongoCollections, getMongoDb } from '../mongo';
import { MediaWiki } from '../media-wiki/media-wiki';
import { Utils } from '../utils';
import { CONFIG } from '../config';
import { RevisionLockInfo } from './types';

if (!CONFIG.MEDIAWIKI.USE_LOCKED_REVISIONS) {
    error('Revisions must be locked to load revisions');
    process.exit(1);
}

// Override this config value to allow the DB to be revised
CONFIG.MEDIAWIKI.USE_LOCKED_REVISIONS = false;

async function loadRevisions() {
    try {
        const startTime = Date.now();
        const jsonStr = await fs.promises.readFile(RevisionLock.path, 'utf-8');
        const { revisions: locks } = JSON.parse(jsonStr) as RevisionLockInfo;
        const db = await getMongoDb();
        const collection = db.collection(MongoCollections.MW_PAGES);

        const mismatches = await Utils.asyncFilter(locks, async (lock) => {
            assert(
                typeof lock.title === 'string',
                `Expected title to be defined for lock on page ${lock.pageId}`,
            );

            assert(
                typeof lock.pageId === 'number',
                `Expected pageId to be defined for lock on page ${lock.title}`,
            );

            assert(
                typeof lock.revisionId === 'number',
                `Expected revisionId to be defined for lock on page ${lock.title}`,
            );

            const document = await collection.findOne(lock);

            return !document;
        });

        await Promise.all(
            mismatches.map(async ({ title, revisionId }) => {
                log(`Updating page '${title}' to revision ${revisionId}`);

                try {
                    await MediaWiki.getPage(title, revisionId);
                } catch (err) {
                    error(`Failed to fetch page by title '${title}'`);
                    throw err;
                }
            }),
        );

        const validate = await Promise.all(
            mismatches.map(async (lock) => [
                lock,
                await collection.findOne(lock),
            ]),
        );

        validate.forEach(([lock, document]) => {
            if (!document) {
                error(
                    `Couldn't find a matching document when validating lock\n    ${JSON.stringify(
                        lock,
                    )}`,
                );
            }
        });

        if (!validate.every(([, document]) => document)) {
            process.exit(1);
        }

        log(
            `Finished loading revision state in ${
                (Date.now() - startTime) / 1000
            }s.`,
        );

        process.exit(0);
    } catch (err) {
        error(err);
        process.exit(1);
    }
}

loadRevisions();
