import { PageData } from '../media-wiki';
import { ClassFeature } from './class-feature';
import { ClassFeatureOther, ClassFeatureSpecial } from './types';

export interface ClassFeatureCustomizationOption {
    pageTitle?: string;
    page?: PageData;
}

export class ClassFeatureCustomizable extends ClassFeature {
    choices?: ClassFeatureCustomizationOption[][];

    constructor(options: ClassFeatureOther | ClassFeatureSpecial) {
        super(options);

        this.customizable = true;
    }
}
