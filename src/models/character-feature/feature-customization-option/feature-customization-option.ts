import { MediaWiki, PageData } from '../../media-wiki';
import { ICharacterFeatureCustomizationOption } from './types';

export class CharacterFeatureCustomizationOption
    implements ICharacterFeatureCustomizationOption
{
    description?: string;

    constructor(
        public label: string,
        public pageTitle: string,
        public page: PageData,
    ) {
        this.initDescription();
    }

    async initDescription(): Promise<void> {
        const data = await MediaWiki.getTextExtract(this.pageTitle, {
            intro: true,
        });

        this.description = data ? data.split('\n')[0].trim() : '<ERROR>';
    }
}
