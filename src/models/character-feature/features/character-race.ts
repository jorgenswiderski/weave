import {
    CharacterPlannerStep,
    ICharacterFeatureCustomizationOption,
} from 'planner-types/src/types/character-feature-customization-option';
import { GrantableEffect } from 'planner-types/src/types/grantable-effect';
import { MwnApiClass } from '../../../api/mwn';
import { error } from '../../logger';
import { MediaWiki } from '../../media-wiki';
import { PageLoadingState } from '../../page-item';
import {
    CharacterFeatureTypes,
    ICharacterFeatureCustomizationOptionWithPage,
} from '../types';
import { CharacterSubrace } from './character-subrace';
import { CharacterFeature } from '../character-feature';

export interface RaceInfo extends ICharacterFeatureCustomizationOption {
    name: string;
    description: string;
    choices?: CharacterSubrace[][];
    choiceType?: CharacterPlannerStep.CHOOSE_SUBRACE;
    image?: string;
}

enum RaceLoadState {
    CHOICES = 'CHOICES',
}

export class CharacterRace extends CharacterFeature {
    choices?: CharacterSubrace[][];
    type: CharacterFeatureTypes.RACE = CharacterFeatureTypes.RACE;

    constructor(options: ICharacterFeatureCustomizationOptionWithPage) {
        super(options);

        this.initialized[RaceLoadState.CHOICES] =
            this.initChoices().catch(error);
    }

    private async initChoices(): Promise<void> {
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
        await this.initialized[RaceLoadState.CHOICES];

        return {
            name: this.name,
            description: await this.getDescription(),
            choices: this?.choices?.length ? this.choices : undefined,
            choiceType: this?.choices?.length
                ? CharacterPlannerStep.CHOOSE_SUBRACE
                : undefined,
            image: (await this.getImage()) ?? undefined,
            grants: this.grants,
        };
    }

    async initGrantableEffects(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            throw new Error('could not find page content');
        }

        // Extract the race features section
        const raceFeaturesSectionMatch = this.page.content.match(
            /====\s*Rac\w+ \w+s\s*====\n([\s\S]+?)\n=/,
        );
        const raceFeaturesSection = raceFeaturesSectionMatch
            ? raceFeaturesSectionMatch[1]
            : '';

        async function parseRacialTraits(
            sectionText: string,
        ): Promise<GrantableEffect[]> {
            // Use a regular expression to extract feature titles
            const featureTitleRegex = /\*\s*\{\{SAI\|([^|]+)/g;

            const featureTitles = [];
            let match;

            while (true) {
                match = featureTitleRegex.exec(sectionText);
                if (match === null) break;
                featureTitles.push(match[1].trim());
            }

            const fx = (
                await Promise.all(
                    featureTitles.map(async (title) =>
                        CharacterFeature.parsePageForGrantableEffect(title),
                    ),
                )
            ).filter(Boolean) as GrantableEffect[];

            return fx;
        }

        this.grants.push(...(await parseRacialTraits(raceFeaturesSection)));

        await this.initialized[RaceLoadState.CHOICES];

        if (this.choices?.[0]) {
            await Promise.all(
                this.choices[0].map(
                    async (choice: CharacterSubrace): Promise<void> => {
                        if (!this.page?.content) {
                            throw new Error('could not find page content');
                        }

                        // Extract the subrace section
                        let subraceFeaturesSectionMatch = new RegExp(
                            `===\\s*${choice.name}\\s*===\\s*\n[\\s\\S]+?\n====\\s*Subrace \\w+?s\\s*====\n([\\s\\S]+?)\n=`,
                        ).exec(this.page.content);

                        if (!subraceFeaturesSectionMatch?.[1]) {
                            subraceFeaturesSectionMatch = new RegExp(
                                `===\\s*${choice.name}\\s*===\\s*\n([\\s\\S]+?)\n=`,
                            ).exec(this.page.content);
                        }

                        const subraceFeaturesSection =
                            subraceFeaturesSectionMatch
                                ? subraceFeaturesSectionMatch[1]
                                : '';

                        // eslint-disable-next-line no-param-reassign
                        choice.grants = await parseRacialTraits(
                            subraceFeaturesSection,
                        );
                    },
                ),
            );
        }
    }
}

let characterRaceData: CharacterRace[];

export async function getCharacterRaceData(): Promise<CharacterRace[]> {
    if (!characterRaceData) {
        const raceNames =
            await MwnApiClass.queryTitlesFromCategory('Playable races');

        characterRaceData = raceNames.map(
            (name) => new CharacterRace({ name, pageTitle: name }),
        );

        await Promise.all(
            characterRaceData.map((cr) => cr.waitForInitialization()),
        );
    }

    return characterRaceData;
}
