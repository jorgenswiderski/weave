import { GrantableEffect } from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import {
    CharacterPlannerStep,
    ICharacterChoiceWithStubs,
    ICharacterOptionWithStubs,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { PageLoadingState } from '../../../page-item';
import { CharacterFeature } from '../../character-feature';
import { CharacterProgressionLevel } from '../../../character-class/types';
import { ICharacterOptionWithPage } from '../../types';
import { PageNotFoundError } from '../../../errors';
import { StaticImageCacheService } from '../../../static-image-cache-service';
import { MediaWikiParser } from '../../../media-wiki/wikitext-parser';
import { characterSubclassParserOverrides } from './overrides';
import { CharacteristicStub } from '../../../static-reference/characteristic-stub';
import { ActionStub } from '../../../static-reference/action-stub';
import { SpellStub } from '../../../static-reference/spell-stub';

export class CharacterSubclass extends CharacterFeature {
    constructor(
        option: ICharacterOptionWithPage,
        public level: number,
    ) {
        super(option, level);
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
        sectionTitle: string,
        level: number,
    ): Promise<ICharacterOptionWithStubs | undefined> {
        if (!this.page) {
            throw new PageNotFoundError();
        }

        const sectionTitlePlain = MediaWikiParser.stripMarkup(sectionTitle);

        const config =
            characterSubclassParserOverrides[this.page.title]?.[level]?.[
                sectionTitlePlain
            ];

        if (config?.ignore) {
            return undefined;
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
                name: sectionTitlePlain,
                choices: [choice],
            };
        }

        const saiPattern = /{{SAI\|([^|}]+?)(?:\|[^}]*?)?}}/g;
        const iconPattern = /{{IconLink\|[^|]+\|([^|}]+?)(?:\|[^}]*?)?}}/g;

        let featureMatches: RegExpMatchArray[] = [];

        if (!config?.disableTitleMatch) {
            featureMatches = [
                ...sectionTitle.matchAll(saiPattern),
                ...sectionTitle.matchAll(iconPattern),
            ];
        }

        if (featureMatches.length === 0 || config?.forceContentMatch) {
            featureMatches = [
                ...featureMatches,
                ...content.matchAll(saiPattern),
                ...content.matchAll(iconPattern),
            ];
        }

        const featureTitles = [
            ...new Set(featureMatches.map((match) => match[1])),
        ];

        const grants = (
            await Promise.all(
                featureTitles.map((title) =>
                    CharacterFeature.parsePageForGrantableEffect(title),
                ),
            )
        ).filter(Boolean) as (
            | GrantableEffect
            | ActionStub
            | SpellStub
            | CharacteristicStub
        )[];

        if (
            grants.length > 1 &&
            (config?.choose || content.match(/Choose (\d|one|a |an )/i))
        ) {
            let count: number = 1;

            if (config?.choose) {
                count = config.choose;
            } else {
                const match = content.match(/Choose (\d)/i);
                count = match?.[1] ? parseInt(match[1], 10) : 1;
            }

            return {
                name: sectionTitlePlain,
                choices: [
                    {
                        type: CharacterPlannerStep.CLASS_FEATURE_SUBCHOICE,
                        options: grants.map((effect) => ({
                            name: effect.name,
                            grants: [effect],
                        })),
                        count: count > 1 ? count : undefined,
                    },
                ],
            };
        }

        return {
            name: sectionTitlePlain,
            grants,
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
                            sectionTitle ?? `Section ${index}`,
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
                        )!;

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

            const merged: ICharacterOptionWithStubs = {
                name: `${this.name} (Level ${level})`,
                choices: redirected.flatMap((option) => option.choices ?? []),
                grants: redirected.flatMap((option) => option.grants ?? []),
            };

            progression[level - 1].Features = [merged];
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

        const choices = levelEffects.flatMap((option) => option.choices ?? []);

        if (choices.length > 0) {
            this.choices = choices;
        }
    }
}
