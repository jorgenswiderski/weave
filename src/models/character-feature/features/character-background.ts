import { ICharacterOption } from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import {
    GrantableEffectType,
    Proficiency,
    ProficiencyTypes,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import { MediaWiki } from '../../media-wiki/media-wiki';
import { CharacterFeature } from '../character-feature';
import { CharacterFeatureTypes, ICharacterOptionWithPage } from '../types';
import { PageNotFoundError } from '../../errors';
import { StaticImageCacheService } from '../../static-image-cache-service';
import { PageLoadingState } from '../../page-item';

enum BackgroundLoadingStates {
    ID = 'BACKGROUND_ID',
}

export class CharacterBackground extends CharacterFeature {
    type: CharacterFeatureTypes.BACKGROUND = CharacterFeatureTypes.BACKGROUND;
    description: string;
    proficiencies: Proficiency[];
    image?: string;
    id?: number;

    constructor(
        options: ICharacterOptionWithPage,
        private sectionContent: string,
    ) {
        super(options);

        this.description = this.parseDescription();
        this.proficiencies = this.getProficiencies();
        this.image = this.getImage() ?? undefined;

        if (this.image) {
            StaticImageCacheService.cacheImage(this.image);
        }

        this.initialized[BackgroundLoadingStates.ID] = this.initId();
    }

    private getImage(): string | null {
        const regex = /\[\[File\s*:\s*([^|\]]+).*|left]]/m;
        const match = regex.exec(this.sectionContent);

        if (!match || !match[1]) {
            return null;
        }

        return match[1].trim();
    }

    private parseDescription(): string {
        const regex = /{{Q\|\s*"([^"]+)"\s*}}/;
        const match = regex.exec(this.sectionContent);

        if (!match || !match[1]) {
            throw new Error('Unable to parse background description');
        }

        return match[1];
    }

    private getProficiencies(): Proficiency[] {
        const regex = /''Improves:\s*([\w\s[\],]+)''/;
        const match = regex.exec(this.sectionContent);

        if (!match || !match[1]) {
            throw new Error('Unable to parse background skills');
        }

        const skillNames = match[1]
            .split(', ')
            .map((skill) => skill.replace('[[', '').replace(']]', '').trim());

        return skillNames.map((sn) => {
            if (
                !Object.values(ProficiencyTypes).includes(
                    sn.toUpperCase() as unknown as ProficiencyTypes,
                )
            ) {
                throw new Error(
                    `invalid proficiency type '${sn.toUpperCase()}'`,
                );
            }

            return {
                name: `Proficiency: ${sn}`,
                type: GrantableEffectType.PROFICIENCY,
                proficiency: sn.toUpperCase() as unknown as ProficiencyTypes,
                description: `Add your proficiency bonus when making ${sn} checks.`,
            };
        });
    }

    private async initId(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page) {
            throw new PageNotFoundError(
                `could not find background ${this.name}`,
            );
        }

        this.id = this.page.pageId;
    }

    toJSON(): ICharacterOption & { id: number } {
        return {
            name: this.name,
            description: this.description,
            image: this.image,
            grants: this.proficiencies,
            id: this.id!,
        };
    }
}

function parseBackgroundSections(
    pageContent: string,
): { name: string; content: string }[] {
    const regex =
        /\n=\s*([\w\s]+)\s*=\s*\n([\s\S]*?)(?=\n=\s*[\w\s]+\s*=\s*\n|\s*$)/g;

    const matches: { name: string; content: string }[] = [];
    let match;

    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(pageContent))) {
        if (!match[2].includes('{{Legacy Content|section}}')) {
            matches.push({
                name: match[1].trim(),
                content: match[2].trim(),
            });
        }
    }

    return matches;
}

let characterBackgroundData: CharacterBackground[];

export async function getCharacterBackgroundData(): Promise<
    CharacterBackground[]
> {
    if (!characterBackgroundData) {
        const pageData = await MediaWiki.getPage('Backgrounds');

        if (!pageData || !pageData.content) {
            throw new Error('no page content');
        }

        const backgroundSections = parseBackgroundSections(pageData.content);

        const data = backgroundSections.map(
            (section) =>
                new CharacterBackground(
                    { name: section.name, pageTitle: section.name },
                    section.content,
                ),
        );

        await Promise.all(data.map((bg) => bg.waitForInitialization()));
        characterBackgroundData = data;
    }

    return characterBackgroundData;
}
