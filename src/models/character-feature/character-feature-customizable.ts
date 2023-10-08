import { CharacterFeature } from './character-feature';
import { ClassFeatureOther, ClassFeatureSpecial } from './class-feature/types';
import {
    ICharacterFeatureCustomizable,
    ICharacterFeatureCustomizationOption,
} from './feature-customization-option/types';

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
        const choicesWithoutPageData =
            this.choices?.map((choice) =>
                choice.map((option) => {
                    const { page, ...optionWithoutPageData } = option;

                    return optionWithoutPageData;
                }),
            ) ?? undefined;

        return { ...super.toJSON(), choices: choicesWithoutPageData };
    }
}
