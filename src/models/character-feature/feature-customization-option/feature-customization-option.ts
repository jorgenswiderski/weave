import { MediaWiki, PageData } from '../../media-wiki';
import { ICharacterFeatureCustomizationOption } from './types';

export class CharacterFeatureCustomizationOption
    implements ICharacterFeatureCustomizationOption
{
    description?: string;
    label: string;

    constructor(
        public pageTitle: string,
        public page: PageData,
    ) {
        this.label = pageTitle.split('(')[0].trim();
        this.initDescription();
    }

    async initDescription(): Promise<void> {
        const data = await MediaWiki.getTextExtract(this.pageTitle, {
            intro: true,
        });

        this.description = data ? data.split('\n')[0].trim() : '<ERROR>';
    }

    toJSON() {
        return {
            name: this.label,
            description: this.description,
        };
    }
}
