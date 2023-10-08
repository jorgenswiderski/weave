import { ICharacterFeatureCustomizable } from '../feature-customization-option/types';
import { CharacterFeatureTypes, ICharacterFeature } from '../types';

export interface ClassFeatureOther extends ICharacterFeature {
    type: CharacterFeatureTypes.OTHER;
    pageTitle: string;
}

export type ClassFeatureTypesSpecial =
    | CharacterFeatureTypes.NONE
    | CharacterFeatureTypes.CHOOSE_SUBCLASS
    | CharacterFeatureTypes.FEAT
    | CharacterFeatureTypes.SUBCLASS_FEATURE
    | CharacterFeatureTypes.SPELLCASTING
    | CharacterFeatureTypes.PACT_MAGIC;

export interface ClassFeatureSpecial extends ICharacterFeature {
    type: ClassFeatureTypesSpecial;
    pageTitle?: string;
}

export interface IClassSubclass extends ICharacterFeatureCustomizable {}
