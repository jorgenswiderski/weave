import {
    CharacterPlannerStep,
    ICharacterOption,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { PageData } from '../media-wiki/media-wiki';

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

export interface ICharacterOptionWithPage extends ICharacterOption {
    pageTitle?: string;
    page?: PageData;
}
