import { ClassFeature } from './class-feature';
import {
    ClassFeatureCustomizationOption,
    ClassFeatureOther,
    ClassFeatureSpecial,
    IClassFeatureCustomizable,
} from './types';

export class ClassFeatureCustomizable
    extends ClassFeature
    implements IClassFeatureCustomizable
{
    choices?: ClassFeatureCustomizationOption[][];

    constructor(options: ClassFeatureOther | ClassFeatureSpecial) {
        super(options);

        this.customizable = true;
    }
}
