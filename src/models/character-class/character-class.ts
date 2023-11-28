import {
    CharacterPlannerStep,
    ICharacterChoice,
    ICharacterOption,
    ICharacterOptionWithStubs,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import assert from 'assert';
import { ClassFeatureFactory } from '../character-feature/class-feature/class-feature-factory';
import { error } from '../logger';
import { MediaWiki } from '../media-wiki/media-wiki';

import { PageItem, PageLoadingState } from '../page-item';
import {
    CharacterClassProgression,
    CharacterClassProgressionLevel,
    ICharacterClass,
} from './types';
import { StaticImageCacheService } from '../static-image-cache-service';
import { CharacterFeature } from '../character-feature/character-feature';
import { MediaWikiParser } from '../media-wiki/media-wiki-parser';
import { ClassSubclassOption } from '../character-feature/features/character-subclass-option';

async function parseFeatures(
    characterClass: CharacterClass,
    value: string,
    level: number,
): Promise<ICharacterOptionWithStubs[]> {
    const features: ICharacterOptionWithStubs[] = [];

    if (value !== '-') {
        const classFeatures = (
            await Promise.all(
                value
                    .split(', ')
                    .map((featureString: string) =>
                        ClassFeatureFactory.fromWikitext(
                            featureString,
                            characterClass,
                            level,
                        ),
                    ),
            )
        ).filter(Boolean) as ICharacterOptionWithStubs[];

        features.push(...classFeatures);
    }

    if (!features.some((feature) => feature instanceof ClassSubclassOption)) {
        const subclassFeature = new ClassSubclassOption(
            characterClass,
            CharacterPlannerStep.SUBCLASS_FEATURE,
            level,
        );

        await subclassFeature.waitForInitialization();

        if (
            subclassFeature.choices?.some((choice) =>
                choice.options.some(
                    (option) =>
                        (option.choices && option.choices.length > 0) ||
                        (option.grants && option.grants.length > 0),
                ),
            )
        ) {
            features.push(subclassFeature);
        }
    }

    return features;
}

enum ClassLoadState {
    PROGRESSION = 'progression',
    DESCRIPTION = 'description',
    IMAGE = 'image',
}

export interface ClassInfo {
    name: string;
    description: string;
    image?: string;
    progression: CharacterClassProgression;
}

export class CharacterClass extends PageItem implements ICharacterClass {
    private image?: string;
    private description?: string;
    private progression?: CharacterClassProgression;

    constructor(public name: string) {
        super({ pageTitle: name });

        this.initialized[ClassLoadState.PROGRESSION] =
            this.initProgression().catch(error);

        this.initialized[ClassLoadState.IMAGE] = this.initImage().catch(error);

        this.initialized[ClassLoadState.DESCRIPTION] =
            this.initDescription().catch(error);
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
                        | ICharacterOptionWithStubs[];
                } = {};

                await Promise.all(
                    Object.keys(item).map(async (key) => {
                        const cleanedKey = MediaWikiParser.stripMarkup(key);

                        if (cleanedKey === 'Features') {
                            // Parse the features last
                            cleanedItem[cleanedKey] = item[key];
                        } else {
                            const value = MediaWikiParser.stripMarkup(
                                item[key],
                            );

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

                const features = await parseFeatures(
                    this,
                    cleanedItem.Features as string,
                    cleanedItem.Level as number,
                );

                cleanedItem.Features = features ?? [];

                await Promise.all(
                    cleanedItem.Features.map((feature) =>
                        (feature as CharacterFeature).waitForInitialization(),
                    ),
                );

                return cleanedItem;
            }),
        );
    }

    private static parseSpellSlots(
        data: {
            [key: string]: string | number | ICharacterOptionWithStubs[];
        }[],
    ): CharacterClassProgression {
        return data.map((rawLevelData) => {
            const levelData: Partial<CharacterClassProgressionLevel> = {};

            Object.entries(rawLevelData).forEach(
                ([key, value]: [
                    string,
                    string | number | ICharacterOptionWithStubs[],
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

    static coerceSpellsKnown(
        data: CharacterClassProgression,
    ): CharacterClassProgression {
        return data.map((levelData: any) => {
            const {
                'Spells Learned': learned,
                'Spells Known': known,
                ...rest
            } = levelData;

            if (!learned) {
                return levelData;
            }

            const totalPrevSpellsKnown = data
                .filter((ld) => ld.Level < levelData.Level)
                .map((ld: any) => ld['Spells Learned'])
                .reduce((acc, v) => acc + v, 0);

            return {
                ...rest,
                'Spells Known': learned + totalPrevSpellsKnown,
            };
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
            this.progression = CharacterClass.coerceSpellsKnown(dataWithSpells);
        } else {
            throw new Error(
                `No class progression table found for "${this.name}"`,
            );
        }
    }

    private async getSubclasses(): Promise<ICharacterChoice> {
        await this.waitForInitialization();

        if (!this.progression) {
            throw new Error('Could not find progression');
        }

        const features = this.progression.map((level) => level.Features).flat();

        await Promise.all(
            features.flatMap((feature) =>
                Object.values((feature as unknown as PageItem).initialized),
            ),
        );

        const chooseSubclass = features.find(
            (feature) =>
                feature?.choices?.[0].type === // FIXME
                CharacterPlannerStep.CHOOSE_SUBCLASS,
        );

        if (!chooseSubclass) {
            throw new Error('Could not find subclass info');
        }

        const feature = chooseSubclass as ICharacterOption;

        if (!feature.choices || !feature.choices[0]) {
            throw new Error('Subclass info has no choices');
        }

        return feature.choices[0];
    }

    private async initImage(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page || !this.page.content) {
            throw new Error('Could not find page content');
        }

        const match = this.page.content.match(
            /{{ClassQuote[^}]+image\s*=\s*([^|}]+)/,
        );

        if (!match || !match[1]) {
            return;
        }

        const image = match[1].trim();

        if (image) {
            StaticImageCacheService.cacheImage(image);
        }

        this.image = image;
    }

    private async initDescription(): Promise<void> {
        this.description = await this.getDescription();
    }

    async getProgression() {
        await this.waitForInitialization();

        return this.progression!;
    }

    toJSON(): ClassInfo {
        const { name, description, image, progression } = this;

        assert(description && progression);

        return {
            name,
            description: description!,
            image,
            progression: progression!,
        };
    }
}

let characterClassData: CharacterClass[];

export async function getCharacterClassData(): Promise<CharacterClass[]> {
    if (!characterClassData) {
        const classNames = await MediaWiki.getTitlesInCategories(['Classes']);

        characterClassData = classNames.map((name) => new CharacterClass(name));

        await Promise.all(
            characterClassData.map((cc) => cc.waitForInitialization()),
        );
    }

    return characterClassData;
}
