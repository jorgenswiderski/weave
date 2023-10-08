import { ICharacterFeature } from '../character-feature/types';
import { PageItem } from '../page-item';

export interface CharacterClassProgressionLevel {
    Level: number;
    'Proficiency Bonus': number;
    Features: ICharacterFeature[];
    'Spell Slots': number[];
    'Cantrips Known'?: number;
    // [key: string]: number | string | undefined;
}

export type CharacterClassProgression = CharacterClassProgressionLevel[];

export interface ICharacterClass extends PageItem {
    name: string;
}
