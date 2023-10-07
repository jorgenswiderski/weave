import { MwnApi } from '../../api/mwn';
import { ClassFeatureFactory } from '../class-feature/class-feature-factory';
import {
    IClassFeatureCustomizationOption,
    ClassFeatureTypes,
    IClassFeature,
    IClassSubclass,
} from '../class-feature/types';
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

export interface ClassBasicInfo {
    name: string;
    description: string;
    subclassNames: string[];
    image?: string;
}

export class CharacterClass extends PageItem {
    private progression?: CharacterClassProgression;

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

    private async getDescription(): Promise<string> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.pageTitle) {
            throw new Error('No page title!');
        }

        const intro = await MediaWiki.getTextExtract(this.pageTitle, {
            intro: true,
        });

        if (!intro) {
            throw new Error('Page intro is null');
        }

        return intro.split('\n')[0].trim();
    }

    private getSubclasses(): IClassFeatureCustomizationOption[] {
        if (!this.progression) {
            throw new Error('Could not find progression');
        }

        const features = this.progression.map((level) => level.Features);
        const chooseSubclass = features
            .flat()
            .find(
                (feature) => feature.type === ClassFeatureTypes.CHOOSE_SUBCLASS,
            );

        if (!chooseSubclass) {
            throw new Error('Could not find subclass info');
        }

        const feature = chooseSubclass as IClassSubclass;

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

    async getBasicInfo(): Promise<ClassBasicInfo> {
        return {
            name: this.name,
            description: await this.getDescription(),
            subclassNames: this.getSubclasses().map((sc) => sc.label),
            image: (await this.getImage()) ?? undefined,
        };
    }

    async getProgression() {
        // Wait for full initialization
        await Promise.all(Object.values(this.initialized));

        return this.progression as CharacterClassProgression;
    }
}

let characterClassData: CharacterClass[];

export async function getCharacterClassData(): Promise<CharacterClass[]> {
    if (!characterClassData) {
        const classNames = await MwnApi.queryTitlesFromCategory('Classes');

        characterClassData = classNames.map((name) => new CharacterClass(name));

        // Wait for all data to load
        await Promise.all(
            characterClassData
                .map((cc) => Object.values(cc.initialized))
                .flat(),
        );

        // const cls = characterClassData.find((c) => c.name === 'Fighter');
        // log(cls?.progression);
    }

    return characterClassData;
}
