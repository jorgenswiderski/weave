import { ICharacterOption } from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { GrantableEffect } from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import { MediaWikiParser } from '../../media-wiki/wikitext-parser';

export class CharacterSubrace implements ICharacterOption {
    label: string;
    description: string;
    grants?: GrantableEffect[];

    constructor(
        public name: string,
        public content: string,
    ) {
        this.label = name;
        this.description = this.initDescription();
    }

    // FIXME: This mostly works, but produces artifacts on a few subraces
    initDescription(): string {
        // Regular expression to capture content between double single quotes or within {{Q|...}}
        const regex = /''(.*?)''|{{Q\|(.*?)(?:\|.*?)*?}}/;
        const match = regex.exec(this.content);

        if (!match) {
            if (MediaWikiParser.stripMarkup(this.content) === this.content) {
                return this.content;
            }

            throw new Error(
                `Unable to parse description from content of page ${this.name}`,
            );
        }

        // Return the first non-null capturing group (either from ''...'' or from {{Q|...}})
        return MediaWikiParser.stripMarkup(match[1] || match[2]).trim();
    }

    toJSON() {
        return {
            name: this.label,
            description: this.description,
            grants: this.grants,
        };
    }
}
