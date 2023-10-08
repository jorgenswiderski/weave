import { MediaWiki } from '../../media-wiki';
import { CharacterFeatureTypes, ICharacterFeature } from '../types';
import { BackgroundInfo } from './types';

export class CharacterBackground implements ICharacterFeature {
    type: CharacterFeatureTypes.BACKGROUND = CharacterFeatureTypes.BACKGROUND;
    description: string;
    skills: string[];
    image?: string;

    constructor(
        public name: string,
        private sectionContent: string,
    ) {
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

    getInfo(): BackgroundInfo {
        return {
            name: this.name,
            description: this.description,
            skills: this.skills,
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
            (section) => new CharacterBackground(section.name, section.content),
        );
    }

    return characterBackgroundData;
}
