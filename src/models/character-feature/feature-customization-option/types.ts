import { ICharacterFeatureCustomizationOption } from 'planner-types/src/types/character-feature-customization-option';
import { ICharacterFeature } from '../types';

export interface ICharacterFeatureCustomizable extends ICharacterFeature {
    choices?: ICharacterFeatureCustomizationOption[][];
}
