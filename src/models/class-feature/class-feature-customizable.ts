import { ClassFeature } from './class-feature';
import {
    IClassFeatureCustomizationOption,
    ClassFeatureOther,
    ClassFeatureSpecial,
    IClassFeatureCustomizable,
} from './types';

export class ClassFeatureCustomizable
    extends ClassFeature
    implements IClassFeatureCustomizable
{
    choices?: IClassFeatureCustomizationOption[][];

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
