/* eslint-disable import/first */
import dotenv from 'dotenv';

dotenv.config({ path: '.env.dump' });

import fs from 'fs/promises';
import { error, log } from './logger';
import { getCharacterClassData } from './character-class/character-class';
import { getCharacterBackgroundData } from './character-feature/features/character-background';
import { getCharacterRaceData } from './character-feature/features/character-race';
import { getMongoDb } from './mongo';
import { getEquipmentItemData } from './equipment/equipment';
import { getSpellDataFiltered } from './action/spell';
import { getActionDataFiltered } from './action/action';
import { initActionsAndSpells } from './action/init';
import { StaticImageCacheService } from './static-image-cache-service';
import { initLocations } from './locations/locations';

async function getInfo(data: any[]) {
    return Promise.all(data.map((datum) => datum.getInfo()));
}

async function dump() {
    try {
        await getMongoDb();
        await initLocations();
        await initActionsAndSpells();

        const datas = {
            'classes/info': getInfo(await getCharacterClassData()),
            'races/info': getInfo(await getCharacterRaceData()),
            'backgrounds/info': getInfo(await getCharacterBackgroundData()),
            'spells/info': getSpellDataFiltered(),
            'actions/info': getActionDataFiltered(),
            'items/equipment': getEquipmentItemData(),
        };

        await Promise.all(
            Object.entries(datas).map(async ([routeName, promise]) => {
                const data = await promise;
                const path = `data-dump/${routeName}.json`;

                await fs.mkdir(path.split('/').slice(0, -1).join('/'), {
                    recursive: true,
                });

                await fs.writeFile(path, JSON.stringify(data, null, 4));

                log(`Dumped ${routeName} to ${path}.`);
            }),
        );

        await StaticImageCacheService.waitForAllImagesToCache();
        await StaticImageCacheService.cleanupCache();

        log('Data dump complete.');
        process.exit(0);
    } catch (err) {
        error('Failed to complete data dump:');
        error(err);
        process.exit(1);
    }
}

StaticImageCacheService.enabled = true;
dump();
