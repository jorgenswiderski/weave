import { PageItem } from '../page-item';
import { ClassFeatureOther, ClassFeatureSpecial } from './class-feature/types';
import { ICharacterFeature, CharacterFeatureTypes } from './types';

export class CharacterFeature extends PageItem implements ICharacterFeature {
    type: CharacterFeatureTypes;
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
