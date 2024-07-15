/* eslint-disable import/first */
import dotenv from 'dotenv';

dotenv.config();

import fs from 'fs/promises';
import { error, log } from './logger';
import { getMongoDb } from './mongo';
import { StaticImageCacheService } from './static-image-cache-service';
import { RevisionLock } from './revision-lock/revision-lock';
import { MediaWiki } from './media-wiki/media-wiki';
import { CONFIG } from './config';
import { MwnTokenBucket } from '../api/mwn';
import { initData } from './init-data';

async function write(data: any, path: string): Promise<void> {
    await fs.mkdir(path.split('/').slice(0, -1).join('/'), {
        recursive: true,
    });

    await fs.writeFile(path, JSON.stringify(data, null, 4));
}

async function dump() {
    try {
        const startTime = Date.now();
        await Promise.all([getMongoDb(), MediaWiki.pruneUnusedPages()]);

        log(`Initializing data...`);
        const data = await initData();

        log(`Flushing to disk...`);
        const ioTasks: Promise<any>[] = [];

        ioTasks.push(
            ...Object.entries(data).map(async ([name, subData]) => {
                const path = `data-dump/${name}.json`;
                await write(subData, path);
                log(`Dumped ${name} to ${path}.`);
            }),
        );

        ioTasks.push(
            RevisionLock.save(MediaWiki.titleRedirects, RevisionLock.deadLinks),
        );

        ioTasks.push(StaticImageCacheService.cleanupCache());
        await Promise.all(ioTasks);

        if (CONFIG.MWN.TRACK_TOKEN_USAGE) {
            MwnTokenBucket.logUsage();
        }

        log(`Data dump complete in ${(Date.now() - startTime) / 1000}s.`);

        process.exit(0);
    } catch (err) {
        error('Failed to complete data dump:');
        error(err);
        process.exit(1);
    }
}

StaticImageCacheService.enabled = CONFIG.MEDIAWIKI.USE_LOCAL_IMAGE_CACHE;
dump();
