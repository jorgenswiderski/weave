import { ICharacterOptionWithStubs } from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { ICharacterClass } from '../../character-class/types';
import { SubclassFeatureOverrides } from '../features/character-subclass/overrides';

export interface IClassFeatureFactory {
    fromWikitext(
        featureText: string,
        characterClass?: ICharacterClass,
        level?: number,
        subclass?: ICharacterOptionWithStubs,
        config?: SubclassFeatureOverrides,
    ): Promise<ICharacterOptionWithStubs | undefined>;
}
