import { ICharacterOption } from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { GrantableEffect } from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import { MediaWikiParser } from '../../media-wiki/media-wiki-parser';
import { CharacterFeature } from '../character-feature';
import { PageItem } from '../../page-item';
import { error } from '../../logger';
import { PageSection } from '../../media-wiki/page-section';
import { Utils } from '../../utils';

enum SubraceLoadingState {
    EFFECTS = 'EFFECTS',
}

export class CharacterSubrace extends PageItem implements ICharacterOption {
    label: string;
    description: string;
    grants?: GrantableEffect[];
    name: string;

    constructor(public section: PageSection) {
        super({});

        this.name = Utils.stringToTitleCase(section.title);
        this.label = this.name;

        this.description = this.initDescription();

        this.initialized[SubraceLoadingState.EFFECTS] =
            this.initOptionsAndEffects().catch(error);
    }

    // FIXME: This mostly works, but produces artifacts on a few subraces
    initDescription(): string {
        // Regular expression to capture content between double single quotes or within {{Q|...}}
        const regex = /''(.*?)''|{{Q\|(.*?)(?:\|.*?)*?}}/i;
        const match = this.section.content.match(regex);

        if (!match) {
            if (
                MediaWikiParser.stripMarkup(this.section.content) ===
                this.section.content
            ) {
                return this.section.content;
            }

            throw new Error(
                `Unable to parse description from content of page ${this.name}`,
            );
        }

        // Return the first non-null capturing group (either from ''...'' or from {{Q|...}})
        return MediaWikiParser.stripMarkup(match[1] || match[2]).trim();
    }

    protected static async parseFeatures(
        content: string,
    ): Promise<GrantableEffect[]> {
        const featureTitles = [
            ...content.matchAll(/\*\s*\{\{SAI\|([^|}]+)[\s\S]*?}}/g),
        ].map((match) => match[1].trim());

        const fx = (
            await Promise.all(
                featureTitles.map(async (title) =>
                    CharacterFeature.parsePageForGrantableEffect(title),
                ),
            )
        ).filter(Boolean) as GrantableEffect[];

        return fx;
    }

    async initOptionsAndEffects(): Promise<void> {
        const featuresSection = this.section.getSubsection('Subrace features');

        if (featuresSection) {
            this.grants = await CharacterSubrace.parseFeatures(
                featuresSection.content,
            );
        } else if (this.name.includes('Dragonborn')) {
            // Dragonborn page has a slightly different format because there are so many options
            this.grants = await CharacterSubrace.parseFeatures(
                this.section.content,
            );
        } else {
            this.grants = [];
        }
    }

    toJSON() {
        return {
            name: this.label,
            description: this.description,
            grants: this.grants,
        };
    }
}
