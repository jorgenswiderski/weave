/* eslint-disable max-classes-per-file */
import { CharacterPlannerStep } from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { CharacterFeature } from '../../character-feature';
import { ChoiceListConfig } from '../../types';

export class CharacterFeatureSorcererMetamagic extends CharacterFeature {
    choiceListConfig: ChoiceListConfig = {
        feature: 'Metamagic',
        minLevel: 'Level',
    };

    protected getChoiceCount(): number {
        return this.level === 2 ? 2 : 1;
    }
}

export class CharacterFeatureWarlockEldritchInvocation extends CharacterFeature {
    choiceListConfig: ChoiceListConfig = {
        feature: 'Invocation',
        minLevel: 'Level',
    };

    protected getChoiceCount(): number {
        return this.level === 2 ? 2 : 1;
    }
}

export class CharacterFeatureWarlockPactBoon extends CharacterFeature {
    async initOptionsAndEffects(): Promise<void> {
        await super.initOptionsAndEffects();

        this.choices![0].type = CharacterPlannerStep.WARLOCK_PACT_BOON;
    }
}
