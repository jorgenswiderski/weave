import { ICharacterFeatureCustomizationOption } from 'planner-types/src/types/character-feature-customization-option';
import { MediaWiki } from '../../media-wiki';
import { CharacterFeature } from '../character-feature';
import { CharacterFeatureTypes } from '../types';

export class CharacterBackground extends CharacterFeature {
    type: CharacterFeatureTypes.BACKGROUND = CharacterFeatureTypes.BACKGROUND;
    description: string;
    skills: string[];
    image?: string;

    constructor(
        options: ICharacterFeatureCustomizationOption,
        private sectionContent: string,
    ) {
        super(options);

        this.description = this.parseDescription();
        this.skills = this.parseSkills();
        this.image = this.getImage() ?? undefined;
    }

    private getImage(): string | null {
        const regex = /\[\[File\s*:\s*([^|\]]+).*|left]]/m;
        const match = regex.exec(this.sectionContent);

        if (!match || !match[1]) {
            return null;
        }

        const fileName = match[1].trim();

        return MediaWiki.getImagePath(fileName);
    }

    private parseDescription(): string {
        const regex = /{{Q\|\s*"([^"]+)"\s*}}/;
        const match = regex.exec(this.sectionContent);

        if (!match || !match[1]) {
            throw new Error('Unable to parse background description');
        }

        return match[1];
    }

    private parseSkills(): string[] {
        const regex = /''Improves:\s*([\w\s[\],]+)''/;
        const match = regex.exec(this.sectionContent);

        if (!match || !match[1]) {
            throw new Error('Unable to parse background skills');
        }

        return match[1]
            .split(', ')
            .map((skill) => skill.replace('[[', '').replace(']]', '').trim());
    }

    getInfo(): ICharacterFeatureCustomizationOption {
        return {
            name: this.name,
            description: this.description,
            // skills: this.skills, TODO: convert to grants
            image: this.image,
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

        characterBackgroundData = backgroundSections.map(
            (section) =>
                new CharacterBackground(
                    { name: section.name },
                    section.content,
                ),
        );
    }

    return characterBackgroundData;
}
