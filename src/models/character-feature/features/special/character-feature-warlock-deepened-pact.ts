import {
    ICharacterChoiceWithStubs,
    CharacterPlannerStep,
    ICharacterOptionWithStubs,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { PageNotFoundError } from '../../../errors';
import { MediaWikiParser } from '../../../media-wiki/media-wiki-parser';
import { MediaWikiTemplate } from '../../../media-wiki/media-wiki-template';
import { PageLoadingState } from '../../../page-item';
import { CharacterFeature } from '../../character-feature';

export class CharacterFeatureWarlockDeepenedPact extends CharacterFeature {
    async initImage(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page) {
            throw new PageNotFoundError();
        }

        const passiveTemplate = await this.page.getTemplate(
            'Passive feature page',
        );

        const { noOp } = MediaWikiTemplate.Parsers;

        const { image } = passiveTemplate.parse({
            image: {
                parser: noOp,
            },
        });

        this.image = image;
    }

    protected async getDescription(): Promise<string> {
        if (!this.page) {
            throw new PageNotFoundError();
        }

        const passiveTemplate = await this.page.getTemplate(
            'Passive feature page',
        );

        const { noOp } = MediaWikiTemplate.Parsers;

        const { description } = passiveTemplate.parse({
            description: {
                parser: noOp,
            },
        });

        return description;
    }

    async initDescription(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        const description = await this.getDescription();
        const match = description.match(/(.+?)\n/)!;

        this.description = MediaWikiParser.stripMarkup(match[1]).trim();
    }

    protected async parseOptions(): Promise<ICharacterOptionWithStubs[]> {
        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        const description = await this.getDescription();

        const pacts = [
            ...description.matchAll(
                /(?<=\n\s*\*)\s*([^:]+?)\s*:\s*([\s\S]+?)(?:\n\s*\*|$)/g,
            ),
        ];

        const options: ICharacterOptionWithStubs[] = await Promise.all(
            pacts.map(async ([, optTitle, optDesc]) => {
                const effectMatches = [
                    ...optDesc.matchAll(/{{SAI\|([^|}]+?)(?:\|[^}]*?)?}}/g),
                ];

                const effects = (
                    await Promise.all(
                        effectMatches.map(([sai]) =>
                            CharacterFeature.factory!.fromWikitext(sai),
                        ),
                    )
                ).filter(Boolean) as CharacterFeature[];

                await Promise.all(
                    effects.map((effect) => effect.waitForInitialization()),
                );

                return {
                    name: MediaWikiParser.stripMarkup(optTitle),
                    description: MediaWikiParser.stripMarkup(optDesc.trim()),
                    type: CharacterPlannerStep.WARLOCK_DEEPENED_PACT,
                    grants: effects.flatMap((effect) => effect.grants),
                };
            }),
        );

        return options;
    }

    async initOptionsAndEffects(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        const choice: ICharacterChoiceWithStubs = {
            type: CharacterPlannerStep.WARLOCK_DEEPENED_PACT,
            options: await this.parseOptions(),
        };

        this.choices = [choice];
    }
}
