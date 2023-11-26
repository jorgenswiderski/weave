/* eslint-disable import/first */
import dotenv from 'dotenv';

dotenv.config();

import { getCharacterClassData } from './character-class/character-class';
import { getCharacterBackgroundData } from './character-feature/features/character-background';
import { getCharacterRaceData } from './character-feature/features/character-race';
import { getEquipmentItemData } from './equipment/equipment';
import { getSpellDataFiltered } from './action/spell';
import { getActionDataFiltered, initActionsAndSpells } from './action/init';
import { getLocationData, initLocations } from './locations/locations';
import { getPassiveDataFiltered, initPassives } from './passive/passive';

export async function initData() {
    const locations = initLocations();
    const actions = initActionsAndSpells();
    const passives = initPassives();

    const tasks: Record<
        string,
        {
            fn: () => Promise<any>;
            dependencies?: (Promise<any> | string)[];
        }
    > = {
        classes: {
            fn: getCharacterClassData,
            dependencies: [actions, passives],
        },
        races: {
            fn: getCharacterRaceData,
            dependencies: [actions, passives],
        },
        backgrounds: { fn: getCharacterBackgroundData },
        equipment: {
            fn: getEquipmentItemData,
            dependencies: [locations],
        },
        locations: {
            fn: async () => getLocationData(),
            dependencies: [locations],
        },
        spells: {
            fn: getSpellDataFiltered,
            dependencies: [actions, 'classes', 'races', 'backgrounds'],
        },
        actions: {
            fn: getActionDataFiltered,
            dependencies: [actions, 'classes', 'races', 'backgrounds'],
        },
        passives: {
            fn: async () => getPassiveDataFiltered(),
            dependencies: [passives, 'classes', 'races', 'backgrounds'],
        },
    };

    const results: Record<keyof typeof tasks, Promise<void>> = {};

    for (let i = 0; i < 100; i += 1) {
        const pendingTasks = Object.entries(tasks).filter(
            ([name]) => !results[name],
        );

        pendingTasks.forEach(([name, { fn, dependencies }]) => {
            const taskDependencies = (dependencies ?? []).filter(
                (dep) => typeof dep === 'string',
            ) as string[];

            if (taskDependencies.every((dep) => results[dep])) {
                const otherDeps = (dependencies ?? []).filter(
                    (dep) => typeof dep !== 'string',
                );

                const deps = [
                    ...otherDeps,
                    ...taskDependencies.map((dep) => results[dep]),
                ];

                results[name] = (async () => {
                    await Promise.all(deps);
                    const data = await fn();

                    return data;
                })();
            }
        });

        if (Object.keys(tasks).every((name) => results[name])) {
            return Object.fromEntries(
                // eslint-disable-next-line no-await-in-loop
                await Promise.all(
                    Object.entries(results).map(async ([name, data]) => [
                        name,
                        await data,
                    ]),
                ),
            );
        }
    }

    throw new Error('Failed to start all tasks, check for cyclic dependencies');
}
