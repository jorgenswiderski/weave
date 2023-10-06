import { MwnApi } from '../../api/mwn';
import { ClassFeatureFactory } from '../class-feature/class-feature-factory';
import { IClassFeature } from '../class-feature/types';
import { error } from '../logger';
import { MediaWiki } from '../media-wiki';

import { PageItem, PageLoadingState } from '../page-item';
import {
    CharacterClassProgression,
    CharacterClassProgressionLevel,
} from './types';

function parseFeatures(
    characterClass: CharacterClass,
    value: string,
): IClassFeature[] {
    if (value === '-') {
        // No features this level
        return [];
    }

    const features = value
        .split(', ')
        .map((featureString: string) =>
            ClassFeatureFactory.fromMarkdownString(
                characterClass,
                featureString,
            ),
        );
    return features;
}

enum ClassLoadState {
    PROGRESSION = 'progression',
}

export class CharacterClass extends PageItem {
    progression?: CharacterClassProgression;

    constructor(public name: string) {
        super(name);

        this.initialized[ClassLoadState.PROGRESSION] =
            this.initProgression().catch(error);
    }

    private cleanProgressionTableData(formattedData: { [key: string]: any }[]) {
        return formattedData.map((item) => {
            const cleanedItem: {
                [key: string]: string | number | IClassFeature[];
            } = {};

            Object.keys(item).forEach((key) => {
                const cleanedKey = MediaWiki.stripMarkup(key);

                if (cleanedKey === 'Features') {
                    cleanedItem[cleanedKey] = parseFeatures(this, item[key]);
                } else {
                    const value = MediaWiki.stripMarkup(item[key]);

                    if (value === '-') {
                        cleanedItem[cleanedKey] = 0;
                        return;
                    }

                    // Try to convert to integer
                    const intValue = parseInt(value, 10);
                    if (!Number.isNaN(intValue)) {
                        cleanedItem[cleanedKey] = intValue;
                    } else {
                        cleanedItem[cleanedKey] = value;
                    }
                }
            });

            return cleanedItem;
        });
    }

    private static parseSpellSlots(
        data: { [key: string]: string | number | IClassFeature[] }[],
    ): CharacterClassProgression {
        return data.map((rawLevelData) => {
            const levelData: Partial<CharacterClassProgressionLevel> = {};

            Object.entries(rawLevelData).forEach(
                ([key, value]: [string, string | number | IClassFeature[]]) => {
                    if (
                        key === '1st' ||
                        key === '2nd' ||
                        key === '3rd' ||
                        /\dth/.test(key)
                    ) {
                        const match = /\d+/.exec(key);

                        if (!match) {
                            return;
                        }

                        const level = parseInt(match[0], 10);

                        levelData['Spell Slots'] =
                            levelData['Spell Slots'] || [];

                        levelData['Spell Slots'][level] = value as number;
                        // eslint-disable-next-line no-param-reassign
                        delete rawLevelData[key];
                    }
                },
            );

            const finalLevelData = {
                ...rawLevelData,
                ...levelData,
            } as CharacterClassProgressionLevel;

            return finalLevelData;
        });
    }

    async initProgression() {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page || !this.page.content) {
            return;
        }

        // Step 1: Isolate the class progression table
        const tableRegex = /\{\|([\s\S]*?)\|\}/g; // Capture everything between {| and |}
        const rowRegex = /\|-\s*([\s\S]*?)(?=\|-\s*|$)/g; // Capture rows between |- and the next |- or end of string
        const cellRegex = /\|([^\n]*)/g; // Capture content of each cell

        const match = tableRegex.exec(this.page.content);

        if (match) {
            const tableContent = match[1];
            const rows = [...tableContent.matchAll(rowRegex)];
            const parsedRows = rows.map((row) => {
                const cells = [...row[1].matchAll(cellRegex)];
                return cells.map((cell) => cell[1].trim());
            });

            const keys = parsedRows[1];
            const dataRows = parsedRows.slice(2);

            const formattedData = dataRows.map((row) => {
                return row.reduce(
                    (obj, cell, index) => {
                        // eslint-disable-next-line no-param-reassign
                        obj[keys[index]] = cell;
                        return obj;
                    },
                    {} as { [key: string]: any },
                );
            });

            const cleanedData = this.cleanProgressionTableData(formattedData);
            const dataWithSpells = CharacterClass.parseSpellSlots(cleanedData);

            this.progression = dataWithSpells;
        } else {
            throw new Error(
                `No class progression table found for "${this.name}"`,
            );
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let classData: CharacterClass[] = [];

export async function getCharacterClassData(): Promise<void> {
    const classNames = await MwnApi.fetchTitlesFromCategory('Classes');

    classData = classNames.map((name) => new CharacterClass(name));

    const cls = classData.find((c) => c.name === 'Fighter');
    await cls?.initialized[ClassLoadState.PROGRESSION];
    // log(cls?.progression);
}
