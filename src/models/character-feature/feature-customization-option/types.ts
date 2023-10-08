import { PageData } from '../../media-wiki';
import { ICharacterFeature } from '../types';

export interface ICharacterFeatureCustomizationOption {
    pageTitle?: string;
    page?: PageData;
    label: string;
    description?: string;
    choices?: ICharacterFeatureCustomizationOption[][];
}

export interface ICharacterFeatureCustomizable extends ICharacterFeature {
    choices?: ICharacterFeatureCustomizationOption[][];
}
