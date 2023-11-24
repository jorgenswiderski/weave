/* eslint-disable import/first */
import dotenv from 'dotenv';

dotenv.config();

import fs from 'fs/promises';
import { error, log } from './logger';
import { getCharacterClassData } from './character-class/character-class';
import { getCharacterBackgroundData } from './character-feature/features/character-background';
import { getCharacterRaceData } from './character-feature/features/character-race';
import { getMongoDb } from './mongo';
import { getEquipmentItemData } from './equipment/equipment';
import { getSpellDataFiltered } from './action/spell';
import { getActionDataFiltered, initActionsAndSpells } from './action/init';
import { StaticImageCacheService } from './static-image-cache-service';
import { initLocations } from './locations/locations';
import { RevisionLock } from './revision-lock/revision-lock';
import { MediaWiki } from './media-wiki/media-wiki';
import { CONFIG } from './config';
import {
    getPassiveDataFiltered,
    initPassives,
} from './characteristic/characteristic';
import { MwnTokenBucket } from '../api/mwn';

CONFIG.MEDIAWIKI.USE_LOCKED_REVISIONS = false;

async function getInfo(data: any[]) {
    return Promise.all(data.map((datum) => datum.getInfo()));
}

async function write(data: any, path: string): Promise<void> {
    await fs.mkdir(path.split('/').slice(0, -1).join('/'), {
        recursive: true,
    });

    await fs.writeFile(path, JSON.stringify(data, null, 4));
}

async function dump() {
    try {
        const startTime = Date.now();

        await getMongoDb();

        await Promise.all([
            initLocations(),
            initActionsAndSpells(),
            initPassives(),
        ]);

        const datas = {
            'classes/info': getInfo(await getCharacterClassData()),
            'races/info': getInfo(await getCharacterRaceData()),
            'backgrounds/info': getInfo(await getCharacterBackgroundData()),
            'spells/info': getSpellDataFiltered(),
            'actions/info': getActionDataFiltered(),
            'items/equipment': getEquipmentItemData(),
            passives: getPassiveDataFiltered(),
        };

        await Promise.all(
            Object.entries(datas).map(async ([routeName, promise]) => {
                const data = await promise;
                const path = `data-dump/${routeName}.json`;
                await write(data, path);
                log(`Dumped ${routeName} to ${path}.`);
            }),
        );

        await RevisionLock.save(MediaWiki.titleRedirects, MediaWiki.deadLinks);
        await StaticImageCacheService.waitForAllImagesToCache();
        await StaticImageCacheService.cleanupCache();

        log(`Data dump complete in ${(Date.now() - startTime) / 1000}s.`);

        if (CONFIG.MWN.TRACK_TOKEN_USAGE) {
            MwnTokenBucket.logUsage();
        }

        process.exit(0);
    } catch (err) {
        error('Failed to complete data dump:');
        error(err);
        process.exit(1);
    }
}

StaticImageCacheService.enabled = CONFIG.MEDIAWIKI.USE_LOCAL_IMAGE_CACHE;
dump();
