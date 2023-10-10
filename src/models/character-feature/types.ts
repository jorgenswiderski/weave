export enum CharacterFeatureTypes {
    NONE = 'NONE',
    CHOOSE_SUBCLASS = 'CHOOSE_SUBCLASS',
    FEAT = 'FEAT',
    SUBCLASS_FEATURE = 'SUBCLASS_FEATURE',
    SPELLCASTING = 'SPELLCASTING',
    PACT_MAGIC = 'PACT_MAGIC',
    OTHER = 'OTHER',

    RACE = 'RACE',
    BACKGROUND = 'BACKGROUND',
}

export enum CharacterEvents {
    CHOOSE_SUBCLASS = 'CHOOSE_SUBCLASS',
    CHOOSE_SUBRACE = 'CHOOSE_SUBRACE',
}

export interface ICharacterFeature {
    type: CharacterFeatureTypes;
}
