import { ICharacterFeatureCustomizationOption } from 'planner-types/src/types/character-feature-customization-option';
import { CharacterFeature } from './character-feature';
import { ClassFeatureOther, ClassFeatureSpecial } from './class-feature/types';
import { ICharacterFeatureCustomizable } from './feature-customization-option/types';

export class CharacterFeatureCustomizable
    extends CharacterFeature
    implements ICharacterFeatureCustomizable
{
    choices?: ICharacterFeatureCustomizationOption[][];

    constructor(options: ClassFeatureOther | ClassFeatureSpecial) {
        super(options);

        this.customizable = true;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            choiceType: this.type,
            choices: this.choices,
        };
    }
}
