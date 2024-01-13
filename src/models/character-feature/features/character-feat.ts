import {
    CharacterPlannerStep,
    ICharacterChoiceWithStubs,
    ICharacterOptionWithStubs,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import {
    PassiveType,
    GrantableEffect,
    GrantableEffectType,
    IPassive,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import assert from 'assert';
import { error } from '../../logger';
import { CharacterFeatureCustomizable } from '../character-feature-customizable';
import { PageLoadingState } from '../../page-item';
import { PageNotFoundError } from '../../errors';
import { CharacterFeature } from '../character-feature';
import { StaticImageCacheService } from '../../static-image-cache-service';
import { MediaWikiParser } from '../../media-wiki/media-wiki-parser';
import { MediaWikiTemplate } from '../../media-wiki/media-wiki-template';

enum SubclassLoadStates {
    CHOICES = 'CHOICES',
}

export class CharacterFeat extends CharacterFeatureCustomizable {
    constructor() {
        super({
            name: `Feat`,
            pageTitle: 'Feats',
        });

        this.initialized[SubclassLoadStates.CHOICES] =
            this.initChoices().catch(error);
    }

    protected static parseAbilityScoreImprovement(
        name: string,
        descriptions: string[],
    ): {
        abilities: string[];
        points: number;
    } | null {
        let abilityImprovement: {
            abilities: string[];
            points: number;
        } | null = null;

        if (name === 'Ability Improvement' || name === 'Resilient') {
            return {
                abilities: [
                    'Strength',
                    'Dexterity',
                    'Constitution',
                    'Intelligence',
                    'Wisdom',
                    'Charisma',
                ],
                points: name === 'Ability Improvement' ? 2 : 1,
            };
        }

        descriptions.forEach((desc) => {
            if (abilityImprovement) {
                return;
            }

            const match = desc.match(
                // Your x (or y) ((ability) score) increases by z
                /Your\s+(\w+)\s+(?:or\s+(\w+)\s+)?(?:(?:ability\s+)score\s+)?increases\s+by\s+(\d+)/i,
            );

            if (match) {
                const abilities = match
                    .slice(1, -1) // Exclude the last group which is the amount
                    .filter(Boolean);

                const points = parseInt(match[match.length - 1], 10);

                assert(abilities.length > 0);

                abilityImprovement = {
                    abilities,
                    points,
                };
            }
        });

        return abilityImprovement;
    }

    protected static parseOptionData(
        name: string,
        featureInfo: { name: string; description?: string }[],
        description?: string,
    ): {
        name: string;
        description: string;
        grants: string[];
        choices: string[];
        abilityImprovement?: {
            abilities: string[];
            points: number;
        };
    } {
        const choicePattern = /\*\*\s*{{SAI\|(.*?)[|}]/g;

        const grants: string[] = featureInfo.map((info) => info.name);

        const choices: string[] = [
            ...[...(description?.matchAll(choicePattern) ?? [])].map(
                ([, optionName]) => optionName,
            ),
        ];

        const featureDescriptions = featureInfo
            .map(({ description: featureDescription }) => featureDescription)
            .filter(Boolean) as string[];

        const abilityImprovement =
            this.parseAbilityScoreImprovement(name, featureDescriptions) ??
            undefined;

        if (description) {
            // eslint-disable-next-line no-param-reassign
            description = MediaWikiParser.stripMarkup(description);

            if (description.includes('*')) {
                // eslint-disable-next-line no-param-reassign
                description = description
                    .split('*')
                    .map((str) => str.trim())
                    .filter((str) => str.length > 0)
                    .join(' ');
            }
        } else {
            // eslint-disable-next-line no-param-reassign
            description = featureDescriptions
                .map((desc) =>
                    desc
                        .split('*')
                        .map((str) => str.trim())
                        .filter((str) => str.length > 0)
                        .join(' '),
                )
                .join('\n\n');
        }

        return {
            name,
            description,
            grants,
            choices,
            abilityImprovement,
        };
    }

    protected static async initOptions(
        data: {
            name: string;
            description: string;
            grants: string[];
            choices: string[];
            abilityImprovement?: {
                abilities: string[];
                points: number;
            };
        }[],
    ): Promise<ICharacterOptionWithStubs[]> {
        return Promise.all(
            data.map(async (featData) => {
                const {
                    name,
                    grants,
                    choices: choiceTitles,
                    description,
                    abilityImprovement,
                } = featData;

                const fx: (GrantableEffect | IPassive)[] = (
                    await Promise.all(
                        grants.map((pageTitle) =>
                            CharacterFeature.parsePageForGrantableEffect(
                                pageTitle,
                            ),
                        ),
                    )
                ).filter(Boolean) as GrantableEffect[];

                const choices: ICharacterChoiceWithStubs[] = [];

                const options: ICharacterOptionWithStubs[] = choiceTitles.map(
                    (title) =>
                        new CharacterFeature({
                            pageTitle: title,
                            name: MediaWikiParser.parseNameFromPageTitle(title),
                        }),
                );

                if (options.length > 0) {
                    choices.push({
                        type: CharacterPlannerStep.FEAT_SUBCHOICE,
                        options,
                    });
                }

                if (abilityImprovement) {
                    if (abilityImprovement.abilities.length > 1) {
                        choices.push({
                            type: CharacterPlannerStep.FEAT_ABILITY_SCORES,
                            options: abilityImprovement.abilities.map(
                                (ability) => ({
                                    name: ability,
                                }),
                            ),
                        });
                    } else {
                        fx.push({
                            name: `${MediaWikiParser.parseNameFromPageTitle(
                                name,
                            )}: ${abilityImprovement.abilities[0]}`,
                            type: GrantableEffectType.PASSIVE,
                            subtype: PassiveType.ABILITY_FEAT,
                            values: {
                                [abilityImprovement.abilities[0]]:
                                    abilityImprovement.points,
                            },
                            // description: `Increases your ${abilityImprovement.abilities[0]} by ${abilityImprovement.points}.`,
                            hidden: true,
                        });
                    }
                }

                const image =
                    fx.find((effect) => effect.image)?.image ??
                    'PassiveFeature Generic.png';

                if (image) {
                    StaticImageCacheService.cacheImage(image);
                }

                return {
                    name,
                    description,
                    image,
                    grants: fx,
                    type: CharacterPlannerStep.FEAT,
                    choices: choices?.length > 0 ? choices : undefined,
                };
            }),
        );
    }

    private async initChoices(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        const templates = await this.page.getTemplates('Table feat');
        const { plainText, noOp } = MediaWikiTemplate.Parsers;

        const config = {
            name: { parser: plainText },
            description: { parser: noOp, default: undefined }, // feat description

            feature1: { parser: plainText, default: undefined },
            description1: { parser: plainText, default: undefined },
            feature2: { parser: plainText, default: undefined },
            description2: { parser: plainText, default: undefined },
            feature3: { parser: plainText, default: undefined },
            description3: { parser: plainText, default: undefined },
        };

        const data = await Promise.all(
            templates.map((template) => {
                const { name, description, ...featureData } = template.parse(
                    config,
                ) as any;

                const features: { name: string; description?: string }[] = [];

                for (let i = 1; i <= 3; i += 1) {
                    const featureName = featureData[`feature${i}`];
                    const featureDescription = featureData[`description${i}`];

                    if (featureName) {
                        features.push({
                            name: featureName,
                            description: featureDescription,
                        });
                    }
                }

                return CharacterFeat.parseOptionData(
                    name,
                    features,
                    description,
                );
            }),
        );

        const options = await CharacterFeat.initOptions(data);

        this.choices = [
            {
                type: CharacterPlannerStep.FEAT,
                options,
            },
        ];
    }
}

export async function getCharacterFeatData(): Promise<CharacterFeat> {
    const feat = new CharacterFeat();
    await feat.waitForInitialization();

    return feat;
}
