import {
    CharacterPlannerStep,
    ICharacterChoiceWithStubs,
    ICharacterOptionWithStubs,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import assert from 'assert';
import { PageLoadingState } from '../../../page-item';
import { CharacterFeature } from '../../character-feature';
import {
    CharacterProgressionLevel,
    ICharacterClass,
} from '../../../character-class/types';
import { PageNotFoundError } from '../../../errors';
import { StaticImageCacheService } from '../../../static-image-cache-service';
import { MediaWikiParser } from '../../../media-wiki/media-wiki-parser';
import { characterSubclassParserOverrides } from './overrides';
import { ICharacterOptionWithPage } from '../../types';
import { IClassFeatureFactory } from '../../class-feature/types';
import { error } from '../../../logger';

export class CharacterSubclass extends CharacterFeature {
    static factory?: IClassFeatureFactory;

    constructor(
        option: ICharacterOptionWithPage,
        public level: number,
        public characterClass: ICharacterClass,
    ) {
        super(option, level, characterClass);
    }

    async initDescription(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            return;
        }

        const descMatch = /{{SubclassQuote\|quote=(.+?)\|image/g;
        const match = descMatch.exec(this.page.content);

        if (!match?.[1]) {
            throw new Error('could not initialize subclass description');
        }

        this.description = MediaWikiParser.stripMarkup(match[1]).trim();
    }

    async initImage(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            return;
        }

        const imageMatch = /{{SubclassQuote\|quote=.+?\|image=([^|}]+)[|}]+/g;
        const match = imageMatch.exec(this.page.content);

        if (!match?.[1]) {
            throw new Error('could not initialize subclass image');
        }

        this.image = match[1];

        if (this.image) {
            StaticImageCacheService.cacheImage(this.image);
        }
    }

    protected async parseSection(
        content: string,
        sectionKey: string | number,
        level: number,
    ): Promise<ICharacterOptionWithStubs | undefined> {
        if (!this.page) {
            throw new PageNotFoundError();
        }

        const config =
            characterSubclassParserOverrides[this.page.title]?.[level]?.[
                typeof sectionKey === 'string'
                    ? MediaWikiParser.stripMarkup(sectionKey)
                    : sectionKey
            ];

        const isAnonymousSection =
            !config?.optionName && typeof sectionKey === 'number';

        const sectionTitle = MediaWikiParser.stripMarkup(
            config?.optionName ??
                ((isAnonymousSection
                    ? `Section ${sectionKey}`
                    : sectionKey) as string),
        );

        if (config?.ignore) {
            return undefined;
        }

        if (config?.redirectTo) {
            return { name: sectionTitle };
        }

        if (
            content.match(/{\|\s*class=("wikitable.*?"|wikitable)[\s\S]+?\|}/)
        ) {
            const options = await this.parseChoiceList(
                content,
                sectionTitle,
                config?.choiceListConfig,
            );

            const choice: ICharacterChoiceWithStubs = {
                type: CharacterPlannerStep.CLASS_FEATURE_SUBCHOICE,
                options,
                count: config?.choose ?? undefined,
            };

            return {
                name: sectionTitle,
                choices: [choice],
            };
        }

        const saiPattern = /{{SAI\|([^|}]+?)(?:\|[^}]*?)?}}/g;
        const iconPattern = /{{IconLink\|[^|]+\|([^|}]+?)(?:\|[^}]*?)?}}/g;
        const linkPattern = /\[\[([^|]*?)(?:\[^}]*?)?]]/g;

        let featureMatches: RegExpMatchArray[] = [];

        if (typeof sectionKey === 'string' && !config?.disableTitleMatch) {
            featureMatches = [
                ...sectionKey.matchAll(saiPattern),
                ...sectionKey.matchAll(iconPattern),
                ...sectionKey.matchAll(linkPattern),
            ];
        }

        const f = (
            await Promise.all(
                featureMatches.map(([m]) =>
                    CharacterSubclass.factory!.fromWikitext(
                        m,
                        this.characterClass,
                        level,
                        this,
                        config,
                    ),
                ),
            )
        ).filter(Boolean) as CharacterFeature[];

        if (f.length === 0 || config?.forceContentMatch) {
            featureMatches = [
                ...featureMatches,
                ...content.matchAll(saiPattern),
                ...content.matchAll(iconPattern),
            ];
        }

        const featureWikitext = [
            ...new Set(featureMatches.map((match) => match[0])),
        ];

        const features = (
            await Promise.all(
                featureWikitext.map((feature) =>
                    CharacterSubclass.factory!.fromWikitext(
                        feature,
                        this.characterClass,
                        level,
                        this,
                        config,
                    ),
                ),
            )
        ).filter(Boolean) as CharacterFeature[];

        await Promise.all(
            features.map((feature) => feature.waitForInitialization()),
        );

        if (
            features.length > 1 &&
            (config?.choose || content.match(/Choose (\d|one|a |an )/i))
        ) {
            if (isAnonymousSection) {
                error(
                    `Expected sectionName to be configured for ${this.name} > Level ${level} > Section ${sectionKey}.`,
                );

                return undefined;
            }

            let count: number = 1;

            if (config?.choose) {
                count = config.choose;
            } else {
                const match = content.match(/Choose (\d)/i);
                count = match?.[1] ? parseInt(match[1], 10) : 1;
            }

            let options: ICharacterOptionWithStubs[];

            if (config?.chooseBullet) {
                const matches = [
                    ...content.matchAll(/\n\s*\*\*\s*([^:]+:[\S]*)\s*(.+)/g),
                ];

                assert(matches.length > 0);

                options = matches.map(([, label, bulletContent]) => {
                    const titles = [
                        ...bulletContent.matchAll(saiPattern),
                        ...bulletContent.matchAll(iconPattern),
                    ].map((m) => m[1]);

                    return {
                        name: MediaWikiParser.stripMarkup(label)
                            .replace(/:$/, '')
                            .trim(),
                        grants: features
                            .filter((feature) => titles.includes(feature.name))
                            .flatMap((feature) => feature.grants),
                    };
                });
            } else {
                options = features;
            }

            return {
                name: sectionTitle,
                choices: [
                    {
                        type: CharacterPlannerStep.CLASS_FEATURE_SUBCHOICE,
                        options,
                        count: count > 1 ? count : undefined,
                    },
                ],
            };
        }

        if (features.length === 1) {
            // Use toJSON to prune extra properties and avoid circular references
            return features[0].toJSON();
        }

        return {
            name: sectionTitle,
            grants: features.flatMap((feature) => feature.grants),
            choices: features.flatMap((feature) => feature.choices ?? []),
        };
    }

    protected async getLevelOptions(
        content: string,
        level: number,
    ): Promise<ICharacterOptionWithStubs[]> {
        if (!this.page) {
            throw new PageNotFoundError();
        }

        const sectionMatches = [
            ...content.matchAll(
                /(?:{{HorizontalRuleImage}}\s*\n|={4,}\s*(.*?)\s*={4,}\s*\n|^)([\s\S]*?)(?=(?:\n\s*====)|$|{{HorizontalRuleImage}})/g,
            ),
        ];

        return (
            await Promise.all(
                sectionMatches.map(
                    ([, sectionTitle, sectionContent], index) => {
                        return this.parseSection(
                            sectionContent,
                            sectionTitle ?? index,
                            level,
                        );
                    },
                ),
            )
        ).filter(Boolean) as ICharacterOptionWithStubs[];
    }

    async getProgression(): Promise<CharacterProgressionLevel[]> {
        if (!this.page?.content) {
            throw new Error('Could not find page content');
        }

        const featureSection =
            /\n\s*==\s*Subclass\sFeatures\s*==\s*\n([\s\S]*?)(?=\n\s*==\s*[^=]+?\s*==\s*\n|{{\w+Navbox}})/i;

        const sectionMatch = featureSection.exec(this.page.content);

        if (!sectionMatch?.[1]) {
            throw new Error(
                `Could not find subclass features for ${this.name}`,
            );
        }

        const levelSection =
            /\n===\s*Level\s(\d+)\s*===\s*\n([\s\S]*?)(?=\n===\s*Level|$)/gi;

        const levelMatches = [...sectionMatch[1].matchAll(levelSection)];

        const progression: CharacterProgressionLevel[] = Array.from({
            length: 12,
        }).map((a, index) => ({
            Level: index + 1,
            Features: [],
        }));

        const optionsByLevel = Object.fromEntries(
            await Promise.all(
                levelMatches.map(async ([, levelStr, content]) => {
                    const level = parseInt(levelStr, 10);

                    return [level, await this.getLevelOptions(content, level)];
                }),
            ),
        );

        const config = characterSubclassParserOverrides[this.page.title];

        (
            Object.entries(optionsByLevel) as unknown as [
                number,
                ICharacterOptionWithStubs[],
            ][]
        ).forEach(([level, options]) => {
            const redirected = options.map((option) => {
                const { name } = option;
                const sectionConfig = config?.[level]?.[name];

                if (sectionConfig?.redirectTo) {
                    const [rLevel, rSection] = sectionConfig.redirectTo;

                    const targetOption: ICharacterOptionWithStubs =
                        optionsByLevel[rLevel].find(
                            (opt: ICharacterOptionWithStubs) =>
                                opt.name === rSection,
                        );

                    assert(targetOption);

                    return {
                        ...targetOption,
                        choices: targetOption.choices
                            ? [
                                  ...targetOption.choices.map((choice) => ({
                                      ...choice,
                                      count:
                                          sectionConfig.choose ?? choice.count,
                                  })),
                              ]
                            : undefined,
                    };
                }

                return option;
            });

            progression[level - 1].Features = redirected;
        });

        return progression;
    }

    async getEffectsByLevel(
        level: number,
    ): Promise<ICharacterOptionWithStubs[]> {
        const progression = await this.getProgression();

        return progression[level - 1].Features;
    }

    async initOptionsAndEffects(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page) {
            throw new PageNotFoundError();
        }

        const levelEffects = await this.getEffectsByLevel(this.level);

        const effects = levelEffects.flatMap((option) => option.grants ?? []);

        if (effects.length > 0) {
            this.grants = effects;
        }

        const choices = levelEffects
            .filter((option) => option.choices?.length)
            .map((option) => ({
                options: [{ ...option, grants: undefined }],
                type: CharacterPlannerStep.CLASS_FEATURE_SUBCHOICE,
            }));

        if (choices.length > 0) {
            this.choices = choices;
        }
    }
}
