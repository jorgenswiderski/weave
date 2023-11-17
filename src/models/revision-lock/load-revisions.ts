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
            const document = await collection.findOne(lock);

            return !document;
        });

        await Promise.all(
            mismatches.map(async ({ title, revisionId }) => {
                log(`Updating page '${title}' to revision ${revisionId}`);
                await MediaWiki.getPage(title, revisionId);
            }),
        );

        const validate = await Promise.all(
            mismatches.map(async (lock) => collection.findOne(lock)),
        );

        assert(validate.every((document) => document));

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
