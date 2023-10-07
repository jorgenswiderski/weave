import { PageItem } from '../page-item';
import {
    IClassFeature,
    ClassFeatureOther,
    ClassFeatureSpecial,
    ClassFeatureTypes,
} from './types';

export class ClassFeature extends PageItem implements IClassFeature {
    type: ClassFeatureTypes;
    customizable: boolean = false;

    constructor(options: ClassFeatureOther | ClassFeatureSpecial) {
        super(options?.pageTitle);

        this.type = options.type;
    }

    toJSON() {
        return {
            type: this.type,
            customizable: this.customizable,
        };
    }
}
