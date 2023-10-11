import { ICharacterFeatureCustomizationOption } from 'planner-types/src/types/character-feature-customization-option';
import { MediaWiki, PageData } from '../../media-wiki';

export class CharacterFeatureCustomizationOption
    implements ICharacterFeatureCustomizationOption
{
    description?: string;
    name: string;

    constructor(
        public pageTitle: string,
        public page: PageData,
    ) {
        this.name = pageTitle.split('(')[0].trim();
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
            name: this.name,
            description: this.description,
        };
    }
}
