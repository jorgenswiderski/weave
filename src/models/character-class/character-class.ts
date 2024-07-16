import {
    CharacterPlannerStep,
    ICharacterOptionWithStubs,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import assert from 'assert';
import { exit } from 'process';
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
import { Utils } from '../utils';
import { CharacterFeat } from '../character-feature/features/character-feat';

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
                    .split(/,\s?/)
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

    await Promise.all(
        features.map((feature) =>
            (feature as CharacterFeature).waitForInitialization(),
        ),
    );

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
            this.initProgression().catch((e) => {
                error(`Critical error initializing progression for ${name}:`);
                error(e);
                exit(1);
            });

        this.initialized[ClassLoadState.IMAGE] = this.initImage().catch(error);

        this.initialized[ClassLoadState.DESCRIPTION] =
            this.initDescription().catch(error);
    }

    private static parseProgressionTableData(
        formattedData: Record<string, any>[],
    ): Record<string, string | number>[] {
        return formattedData.map((item) => {
            const cleanedItem: Record<string, string | number> = {};

            Object.keys(item).forEach((key) => {
                const cleanedKey = MediaWikiParser.stripMarkup(key);

                if (cleanedKey === 'Features') {
                    // skip parsing the features, that's handled in a dedicated function is its more complex
                    cleanedItem[cleanedKey] = item[key];
                } else {
                    const value = MediaWikiParser.stripMarkup(item[key]);

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

    private async parseProgressionFeatures(
        data: Record<string, string | number>[],
    ): Promise<
        Record<string, string | number | ICharacterOptionWithStubs[]>[]
    > {
        return Promise.all(
            data.map(async (item) => {
                const features = await parseFeatures(
                    this,
                    item.Features as string,
                    item.Level as number,
                );

                return {
                    ...item,
                    Features: features,
                };
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

        if (!this.page?.content) {
            throw new Error('Could not find character class page content');
        }

        const tableData = MediaWikiParser.parseWikiTable(
            this.page.content,
            'record',
        );

        const formattedData =
            CharacterClass.parseProgressionTableData(tableData);

        const dataWithFeatures =
            await this.parseProgressionFeatures(formattedData);

        const dataWithSpells = CharacterClass.parseSpellSlots(dataWithFeatures);
        this.progression = CharacterClass.coerceSpellsKnown(dataWithSpells);
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
        const description = await this.getDescription();

        this.description = Utils.stringToSentences(description)
            .filter((sentence) => !sentence.match(/is a (?:character )?class/i))
            .join('');
    }

    toJSON(): ClassInfo {
        const { name, description, image, progression } = this;

        assert(
            description,
            `Description for class '${name}' should be defined`,
        );

        assert(
            progression,
            `Progression for class '${name}' should be defined`,
        );

        return {
            name,
            description: description!,
            image,
            progression: progression!,
        };
    }
}

let characterClassData: CharacterClass[];

async function initCharacterClassData(): Promise<void> {
    const classNames = await MediaWiki.getTitlesInCategories(['Classes']);

    characterClassData = classNames.map((name) => new CharacterClass(name));

    await Promise.all(
        characterClassData.map((cc) => cc.waitForInitialization()),
    );
}

export async function getCharacterClassData(): Promise<CharacterClass[]> {
    if (!characterClassData) {
        await initCharacterClassData();
    }

    return characterClassData;
}

function excludeFeatData(data: CharacterClass[]) {
    const excluded = data.map((cls) => ({
        ...cls.toJSON(),
        progression: (cls as any).progression.map(
            (level: CharacterClassProgressionLevel) => ({
                ...level,
                Features: level.Features.map((feature) => {
                    if (feature instanceof CharacterFeat) {
                        return {
                            ...feature.toJSON(),
                            choices: undefined,
                        };
                    }

                    return feature;
                }),
            }),
        ),
    }));

    return excluded;
}

export async function getCharacterClassDataWithoutFeats(): Promise<any[]> {
    if (!characterClassData) {
        await initCharacterClassData();
    }

    return excludeFeatData(characterClassData);
}
