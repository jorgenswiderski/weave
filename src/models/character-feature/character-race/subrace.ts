import { ICharacterFeatureCustomizationOption } from '../feature-customization-option/types';

export class CharacterSubrace implements ICharacterFeatureCustomizationOption {
    label: string;

    constructor(
        public name: string,
        public content: string,
    ) {
        this.label = name;
    }

    toJSON() {
        return {
            name: this.label,
        };
    }
}
