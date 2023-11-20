/* eslint-disable max-classes-per-file */
import { CharacterFeature } from '../../character-feature';
import { ChoiceListConfig } from '../../types';

export class CharacterFeatureSorcererMetamagic extends CharacterFeature {
    choiceListConfig: ChoiceListConfig = {
        feature: 'Metamagic',
        minLevel: 'Level',
    };
}

export class CharacterFeatureWarlockEldritchInvocation extends CharacterFeature {
    choiceListConfig: ChoiceListConfig = {
        feature: 'Invocation',
        minLevel: 'Level',
    };
}
