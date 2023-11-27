import {
    CharacterPlannerStep,
    ICharacterChoiceWithStubs,
    ICharacterOptionWithStubs,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { ISpell } from '@jorgenswiderski/tomekeeper-shared/dist/types/action';
import { PageNotFoundError } from '../../../errors';
import { CharacterFeature } from '../../character-feature';
import { PageLoadingState } from '../../../page-item';
import { ICharacterOptionWithPage } from '../../types';

// Used for features like Mystic Arcanum & Magical Secrets
export class CharacterFeatureLearnSpell extends CharacterFeature {
    constructor(
        option: ICharacterOptionWithPage,
        public level: number,
    ) {
        super(option, level);
    }

    choiceListCount = this.name === 'Magical Secrets' ? 2 : 1;

    protected async parseAvailableSpells(): Promise<
        ICharacterOptionWithStubs[]
    > {
        if (!this.page) {
            throw new PageNotFoundError();
        }

        const section = this.page.getSection('Available Spells')!;

        const featureMarkdown = [
            ...section.content.matchAll(/{{(SAI|SmIconLink)\|[^}]+}}/g),
        ].map((match) => match[0]);

        const options = (
            await Promise.all(
                featureMarkdown.map((md) =>
                    CharacterFeature.factory!.fromWikitext(md),
                ),
            )
        ).filter(Boolean) as CharacterFeature[];

        await Promise.all(
            options.map((option) => option.waitForInitialization()),
        );

        const filtered = options.filter(({ grants }) => {
            const spell: ISpell | undefined = (grants[0] as any)?.spell;

            return !spell || spell.level * 2 - 1 <= this.level;
        });

        return filtered;
    }

    async initOptionsAndEffects(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        const choice: ICharacterChoiceWithStubs = {
            type: CharacterPlannerStep.CLASS_FEATURE_LEARN_SPELL,
            count: this.getChoiceCount(),
            options: await this.parseAvailableSpells(),
        };

        this.choices = [choice];
    }
}
