import { ICharacterOptionWithStubs } from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { ICharacterClass } from '../../character-class/types';

export interface IClassFeatureFactory {
    fromWikitext(
        featureText: string,
        characterClass?: ICharacterClass,
        level?: number,
    ): Promise<ICharacterOptionWithStubs | undefined>;
}
