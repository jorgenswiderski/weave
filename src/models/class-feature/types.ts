export enum ClassFeatureTypes {
    NONE = 'NONE',
    CHOOSE_SUBCLASS = 'CHOOSE_SUBCLASS',
    FEAT = 'FEAT',
    SUBCLASS_FEATURE = 'SUBCLASS_FEATURE',
    SPELLCASTING = 'SPELLCASTING',
    PACT_MAGIC = 'PACT_MAGIC',
    OTHER = 'OTHER',
}

export interface IClassFeature {
    type: ClassFeatureTypes;
}

export interface ClassFeatureOther extends IClassFeature {
    type: ClassFeatureTypes.OTHER;
    pageTitle: string;
}

export type ClassFeatureTypesSpecial =
    | ClassFeatureTypes.NONE
    | ClassFeatureTypes.CHOOSE_SUBCLASS
    | ClassFeatureTypes.FEAT
    | ClassFeatureTypes.SUBCLASS_FEATURE
    | ClassFeatureTypes.SPELLCASTING
    | ClassFeatureTypes.PACT_MAGIC;

export interface ClassFeatureSpecial extends IClassFeature {
    type: ClassFeatureTypesSpecial;
    pageTitle?: string;
}
