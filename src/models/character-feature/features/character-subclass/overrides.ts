import { ChoiceListConfig } from '../../types';

export interface SubclassFeatureOverrides {
    ignore?: true;
    choiceListConfig?: Partial<ChoiceListConfig>;
    redirectTo?: [number, string];
    disableTitleMatch?: true;
    // Allows matching section content of sections that also have an effect in the section title
    forceContentMatch?: true;
    choose?: number;
    chooseBullet?: true;
}

type Overrides = Record<
    string,
    Record<number, Record<string, SubclassFeatureOverrides>>
>;

const Barbarian: Overrides = {
    'Wild Magic (Barbarian subclass)': {
        3: {
            'Wild Magic Effects': {
                ignore: true,
            },
        },
        6: {
            'Bolstering Magic': {
                ignore: true,
            },
        },
        9: {
            'Bolstering Magic: Level 3 Spell Slot': {
                ignore: true,
            },
        },
    },
    Berserker: {
        3: {
            Frenzy: {
                forceContentMatch: true,
            },
        },
    },
    Wildheart: {
        3: {
            'Bestial Heart': {
                choiceListConfig: {
                    name: 'Bestial Hearts',
                    feature: 'Grants',
                    matchAll: true,
                },
            },
        },
        10: {
            'Additional Animal Aspect': {
                redirectTo: [6, 'Animal Aspect'],
            },
        },
    },
};

const Bard: Overrides = {
    'College of Swords': {
        3: {
            'Blade Flourish': {
                disableTitleMatch: true,
                forceContentMatch: true,
            },
        },
    },
};

const Cleric: Overrides = {
    'Nature Domain': {
        1: {
            'Acolyte of Nature': {
                forceContentMatch: true,
            },
        },
    },
    'Tempest Domain': {
        1: {
            'Wrath of the Storm': {
                disableTitleMatch: true,
            },
        },
    },
};

const Druid: Overrides = {
    'Circle of the Land': {
        3: {
            'Section 0': {
                choose: 1,
                chooseBullet: true,
            },
        },
        5: {
            'Section 0': {
                choose: 1,
                chooseBullet: true,
            },
        },
        7: {
            'Section 0': {
                choose: 1,
                chooseBullet: true,
            },
        },
        9: {
            'Section 0': {
                choose: 1,
                chooseBullet: true,
            },
        },
    },
};

const Fighter: Overrides = {
    'Battle Master': {
        3: {
            Manoeuvres: {
                choiceListConfig: {
                    feature: 'Grants',
                    name: 'Manoeuvres',
                    matchAll: true,
                },
                choose: 3,
            },
        },
        7: {
            Manoeuvres: {
                redirectTo: [3, 'Manoeuvres'],
                choose: 2,
            },
        },
        10: {
            Manoeuvres: {
                redirectTo: [3, 'Manoeuvres'],
                choose: 2,
            },
        },
    },
};

const Rogue: Overrides = {
    'Gloom Stalker': {
        3: {
            'Dread Ambusher': {
                forceContentMatch: true,
            },
        },
    },
};

const Sorcerer: Overrides = {
    'Draconic Bloodline': {
        1: {
            'Draconic Ancestry (Choose 1)': {
                choiceListConfig: {
                    feature2: 'Grants',
                },
            },
        },
    },
    'Storm Sorcery': {
        6: {
            'Heart of the Storm': {
                disableTitleMatch: true,
                forceContentMatch: true,
            },
        },
    },
};

const Wizard: Overrides = {
    'Necromancy School': {
        6: {
            'Undead Thralls: Animate Dead': {
                disableTitleMatch: true,
                forceContentMatch: true,
            },
        },
    },
};

export const characterSubclassParserOverrides: Overrides = {
    ...Barbarian,
    ...Bard,
    ...Cleric,
    ...Druid,
    ...Fighter,
    ...Rogue,
    ...Sorcerer,
    ...Wizard,
};
