import { CharacterPlannerStep } from 'planner-types/src/types/character-feature-customization-option';
import {
    GrantableEffect,
    GrantableEffectType,
} from 'planner-types/src/types/grantable-effect';
import { error } from '../../logger';
import { MediaWiki } from '../../media-wiki';
import { CharacterFeatureCustomizable } from '../character-feature-customizable';
import { PageLoadingState } from '../../page-item';
import { PageNotFoundError } from '../../errors';
import { CharacterFeature } from '../character-feature';

enum SubclassLoadStates {
    CHOICES = 'CHOICES',
}

export class CharacterFeat extends CharacterFeatureCustomizable {
    constructor() {
        super({
            name: `Feat`,
            pageTitle: 'Feats',
            choiceType: CharacterPlannerStep.FEAT,
        });

        this.initialized[SubclassLoadStates.CHOICES] =
            this.initChoices().catch(error);
    }

    private async initChoices(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        const featPattern =
            /\|{{anchor\|([^}]+)}} '''(.*?)''' \|\|([\s\S]*?)(?=\|-\n|\|-|$)/g;
        const grantPattern = /[^*]\s*'''{{SAI\|(.*?)\|/g;
        const choicePattern = /\*\s*'''{{SAI\|(.*?)[|}]/g;

        const feats: {
            [key: string]: {
                grants: string[];
                choices: string[];
                description: string;
            };
        } = {};

        Array.from(this.page.content.matchAll(featPattern)).forEach((match) => {
            const featName = match[2].trim();
            const grants: string[] = [];
            const choices: string[] = [];

            Array.from(match[3].matchAll(grantPattern)).forEach(
                (abilityMatch) => {
                    grants.push(abilityMatch[1].trim());
                },
            );

            Array.from(match[3].matchAll(choicePattern)).forEach(
                (abilityMatch) => {
                    choices.push(abilityMatch[1].trim());
                },
            );

            feats[featName] = {
                grants,
                choices,
                description: MediaWiki.stripMarkup(match[3]).trim(),
            };
        });

        this.choices = [
            await Promise.all(
                Object.entries(feats).map(async ([name, data]) => {
                    const { grants, choices: choiceTitles, description } = data;
                    const fx = (
                        await Promise.all(
                            grants.map((pageTitle) =>
                                CharacterFeature.parsePageForGrantableEffect(
                                    pageTitle,
                                ),
                            ),
                        )
                    ).filter(Boolean) as GrantableEffect[];

                    const choices = choiceTitles.map(
                        (title) =>
                            new CharacterFeature({
                                pageTitle: title,
                                name: CharacterFeature.parseNameFromPageTitle(
                                    title,
                                ),
                            }),
                    );

                    if (fx.length === 0 && choices.length === 0) {
                        fx.push({
                            name: CharacterFeature.parseNameFromPageTitle(name),
                            description,
                            type: GrantableEffectType.CHARACTERISTIC,
                        });
                    }

                    return {
                        name,
                        description,
                        image: fx.find((effect) => effect.image)?.image,
                        grants: fx,
                        type: CharacterPlannerStep.FEAT,
                        choiceType:
                            choices?.length > 0
                                ? CharacterPlannerStep.FEAT_SUBCHOICE
                                : undefined,
                        choices: choices?.length > 0 ? [choices] : undefined,
                    };
                }),
            ),
        ];
    }
}
