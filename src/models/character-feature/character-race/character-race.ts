import {
    CharacterPlannerStep,
    ICharacterFeatureCustomizationOption,
} from 'planner-types/src/types/character-feature-customization-option';
import { MwnApi } from '../../../api/mwn';
import { error } from '../../logger';
import { MediaWiki } from '../../media-wiki';
import { PageItem, PageLoadingState } from '../../page-item';
import { ICharacterFeatureCustomizable } from '../feature-customization-option/types';
import { CharacterFeatureTypes } from '../types';
import { CharacterSubrace } from './subrace';

export interface RaceInfo extends ICharacterFeatureCustomizationOption {
    name: string;
    description: string;
    choices?: CharacterSubrace[][];
    choiceType?: CharacterPlannerStep.CHOOSE_SUBRACE;
    image?: string;
}

enum RaceLoadState {
    SUBRACES,
}

export class CharacterRace
    extends PageItem
    implements ICharacterFeatureCustomizable
{
    choices?: CharacterSubrace[][];
    type: CharacterFeatureTypes.RACE = CharacterFeatureTypes.RACE;

    constructor(public name: string) {
        super(name);

        this.initialized[RaceLoadState.SUBRACES] =
            this.initSubraces().catch(error);
    }

    private async initSubraces(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page || !this.page.content) {
            throw new Error('Could not find page content');
        }

        const subracePattern = /\n===\s*([^=]*?)\s*===\n\s*([\s\S]*?)(?===|$)/g;

        let match;
        const choices: CharacterSubrace[][] = [[]];

        while (true) {
            match = subracePattern.exec(this.page.content);
            if (!match) break;

            choices[0].push(new CharacterSubrace(match[1], match[2].trim()));
        }

        if (choices.flat().length) {
            this.choices = choices;
        }
    }

    private async getImage(): Promise<string | null> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page || !this.page.content) {
            throw new Error('Could not find page content');
        }

        const regex = /\[\[File\s*:\s*([^|\]]+).*|right]]/m;
        const match = regex.exec(this.page.content);

        if (!match || !match[1]) {
            return null;
        }

        const fileName = match[1].trim();

        return MediaWiki.getImagePath(fileName);
    }

    protected async getDescription(): Promise<string> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page || !this.page.content) {
            throw new Error('Could not find page content');
        }

        const descPattern =
            /==\s*About\s(?:the\s)?[\w-]+?\s*==\n+([\s\S]+?)\n+=/;
        const match = this.page.content.match(descPattern);

        if (!match || !match[1]) {
            return super.getDescription();
        }

        return MediaWiki.stripMarkup(match[1]).trim().split('\n')[0];
    }

    async getInfo(): Promise<RaceInfo> {
        await this.initialized[RaceLoadState.SUBRACES];

        return {
            name: this.name,
            description: await this.getDescription(),
            choices: this?.choices?.length ? this.choices : undefined,
            choiceType: this?.choices?.length
                ? CharacterPlannerStep.CHOOSE_SUBRACE
                : undefined,
            image: (await this.getImage()) ?? undefined,
        };
    }
}

let characterRaceData: CharacterRace[];

export async function getCharacterRaceData(): Promise<CharacterRace[]> {
    if (!characterRaceData) {
        const raceNames =
            await MwnApi.queryTitlesFromCategory('Playable races');

        characterRaceData = raceNames.map((name) => new CharacterRace(name));

        // Wait for all data to load
        await Promise.all(
            characterRaceData.map((cr) => Object.values(cr.initialized)).flat(),
        );
    }

    return characterRaceData;
}
