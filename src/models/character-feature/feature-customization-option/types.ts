import { CharacterEvents, ICharacterFeature } from '../types';

export interface ICharacterFeatureCustomizationOption {
    name: string;
    description?: string;
    choices?: ICharacterFeatureCustomizationOption[][];
    choiceType?: CharacterEvents;
}

export interface ICharacterFeatureCustomizationOptionWithChoices
    extends ICharacterFeatureCustomizationOption {
    choices: ICharacterFeatureCustomizationOption[][];
    choiceType: CharacterEvents;
}

export interface ICharacterFeatureCustomizationOptionWithoutChoices
    extends ICharacterFeatureCustomizationOption {
    choices?: undefined;
    choiceType?: undefined;
}

export type ICharacterFeatureCustomizationOptionStrict =
    | ICharacterFeatureCustomizationOptionWithChoices
    | ICharacterFeatureCustomizationOptionWithoutChoices;

export interface ICharacterFeatureCustomizable extends ICharacterFeature {
    choices?: ICharacterFeatureCustomizationOption[][];
}
