/* eslint-disable import/first */
import dotenv from 'dotenv';

dotenv.config();

import fs from 'fs/promises';
import { error, log } from './logger';
import { getCharacterClassData } from './character-class/character-class';
import { getCharacterBackgroundData } from './character-feature/features/character-background';
import { getCharacterRaceData } from './character-feature/features/character-race';
import { getSpellData } from './spell/spell';
import { getMongoDb } from './mongo';
import { getEquipmentItemData } from './equipment/equipment-item';

async function getInfo(data: any[]) {
    return Promise.all(data.map((datum) => datum.getInfo()));
}

async function dump() {
    try {
        await getMongoDb();

        const datas = {
            'classes/info': getInfo(await getCharacterClassData()),
            'races/info': getInfo(await getCharacterRaceData()),
            'backgrounds/info': getInfo(await getCharacterBackgroundData()),
            'spells/info': getSpellData(),
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

        log('Data dump complete.');
        process.exit(0);
    } catch (err) {
        error('Failed to complete data dump:');
        error(err);
        process.exit(1);
    }
}

dump();
