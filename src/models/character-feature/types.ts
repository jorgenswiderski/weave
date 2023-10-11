import {
    CharacterPlannerStep,
    ICharacterFeatureCustomizationOption,
} from 'planner-types/src/types/character-feature-customization-option';

export enum CharacterFeatureTypes {
    NONE = 'NONE',
    FEAT = 'FEAT',
    SUBCLASS_FEATURE = 'SUBCLASS_FEATURE',
    SPELLCASTING = 'SPELLCASTING',
    PACT_MAGIC = 'PACT_MAGIC',
    OTHER = 'OTHER',

    CHOOSE_SUBCLASS = CharacterPlannerStep.CHOOSE_SUBCLASS,
    RACE = CharacterPlannerStep.SET_RACE,
    BACKGROUND = CharacterPlannerStep.SET_BACKGROUND,
}

export interface ICharacterFeatureCustomizationOptionWithPage
    extends ICharacterFeatureCustomizationOption {
    pageTitle?: string;
}
