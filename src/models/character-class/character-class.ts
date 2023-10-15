import {
    CharacterPlannerStep,
    ICharacterFeatureCustomizationOption,
} from 'planner-types/src/types/character-feature-customization-option';
import { MwnApiClass } from '../../api/mwn';
import { ClassFeatureFactory } from '../character-feature/class-feature/class-feature-factory';
import { error } from '../logger';
import { MediaWiki } from '../media-wiki';

import { PageItem, PageLoadingState } from '../page-item';
import {
    CharacterClassProgression,
    CharacterClassProgressionLevel,
    ICharacterClass,
} from './types';

async function parseFeatures(
    characterClass: CharacterClass,
    value: string,
    level: number,
): Promise<ICharacterFeatureCustomizationOption[]> {
    if (value === '-') {
        // No features this level
        return [];
    }

    const features = await Promise.all(
        value
            .split(', ')
            .map((featureString: string) =>
                ClassFeatureFactory.fromMarkdownString(
                    characterClass,
                    featureString,
                    level,
                ),
            ),
    );

    return features;
}

enum ClassLoadState {
    PROGRESSION = 'progression',
}

export interface ClassInfo {
    name: string;
    description: string;
    subclassNames: string[];
    image?: string;
    progression: CharacterClassProgression;
}

export class CharacterClass extends PageItem implements ICharacterClass {
    private progression?: CharacterClassProgression;

    constructor(public name: string) {
        super({ pageTitle: name });

        this.initialized[ClassLoadState.PROGRESSION] =
            this.initProgression().catch(error);
    }

    private async cleanProgressionTableData(
        formattedData: { [key: string]: any }[],
    ) {
        return Promise.all(
            formattedData.map(async (item) => {
                const cleanedItem: {
                    [key: string]:
                        | string
                        | number
                        | ICharacterFeatureCustomizationOption[];
                } = {};

                await Promise.all(
                    Object.keys(item).map(async (key) => {
                        const cleanedKey = MediaWiki.stripMarkup(key);

                        if (cleanedKey === 'Features') {
                            // Parse the features last
                            cleanedItem[cleanedKey] = item[key];
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
                    }),
                );

                cleanedItem.Features = await parseFeatures(
                    this,
                    cleanedItem.Features as string,
                    cleanedItem.Level as number,
                );

                return cleanedItem;
            }),
        );
    }

    private static parseSpellSlots(
        data: {
            [key: string]:
                | string
                | number
                | ICharacterFeatureCustomizationOption[];
        }[],
    ): CharacterClassProgression {
        return data.map((rawLevelData) => {
            const levelData: Partial<CharacterClassProgressionLevel> = {};

            Object.entries(rawLevelData).forEach(
                ([key, value]: [
                    string,
                    string | number | ICharacterFeatureCustomizationOption[],
                ]) => {
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
            throw new Error('Could not find character class page content');
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

            const cleanedData =
                await this.cleanProgressionTableData(formattedData);
            const dataWithSpells = CharacterClass.parseSpellSlots(cleanedData);

            this.progression = dataWithSpells;
        } else {
            throw new Error(
                `No class progression table found for "${this.name}"`,
            );
        }
    }

    private async getSubclasses(): Promise<
        ICharacterFeatureCustomizationOption[]
    > {
        await this.waitForInitialization();

        if (!this.progression) {
            throw new Error('Could not find progression');
        }

        const features = this.progression.map((level) => level.Features);
        const chooseSubclass = features
            .flat()
            .find(
                (feature) =>
                    feature.choiceType === CharacterPlannerStep.CHOOSE_SUBCLASS,
            );

        if (!chooseSubclass) {
            throw new Error('Could not find subclass info');
        }

        const feature = chooseSubclass as ICharacterFeatureCustomizationOption;

        if (!feature.choices || !feature.choices[0]) {
            throw new Error('Subclass info has no choices');
        }

        return feature.choices[0];
    }

    private async getImage(): Promise<string | null> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page || !this.page.content) {
            throw new Error('Could not find page content');
        }

        const match = this.page.content.match(
            /{{ClassQuote[^}]+image=([^|}]+)/,
        );

        if (!match || !match[1]) {
            return null;
        }

        const fileName = match[1].trim();

        return MediaWiki.getImagePath(fileName);
    }

    async getInfo(): Promise<ClassInfo> {
        return {
            name: this.name,
            description: await this.getDescription(),
            subclassNames: (await this.getSubclasses()).map((sc) => sc.name),
            image: (await this.getImage()) ?? undefined,
            progression: await this.getProgression(),
        };
    }

    async getProgression() {
        await this.waitForInitialization();

        return this.progression as CharacterClassProgression;
    }
}

let characterClassData: CharacterClass[];

export async function getCharacterClassData(): Promise<CharacterClass[]> {
    if (!characterClassData) {
        const classNames = await MwnApiClass.queryTitlesFromCategory('Classes');

        characterClassData = classNames.map((name) => new CharacterClass(name));

        await Promise.all(
            characterClassData.map((cc) => cc.waitForInitialization()),
        );
    }

    return characterClassData;
}
