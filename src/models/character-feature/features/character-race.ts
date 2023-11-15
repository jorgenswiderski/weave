import {
    CharacterPlannerStep,
    ICharacterOptionWithStubs,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { GrantableEffect } from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import { MwnApiClass } from '../../../api/mwn';
import { error } from '../../logger';
import { MediaWiki } from '../../media-wiki/media-wiki';
import { PageLoadingState } from '../../page-item';
import { CharacterFeatureTypes, ICharacterOptionWithPage } from '../types';
import { CharacterSubrace } from './character-subrace';
import { CharacterFeature } from '../character-feature';
import { Utils } from '../../utils';
import { StaticImageCacheService } from '../../static-image-cache-service';

type RaceChoice = { type: CharacterPlannerStep; options: CharacterSubrace[] };

export interface RaceInfo extends ICharacterOptionWithStubs {
    name: string;
    description: string;
    choices?: RaceChoice[];
    choiceType?: CharacterPlannerStep.CHOOSE_SUBRACE;
    image?: string;
}

enum RaceLoadState {
    CHOICES = 'CHOICES',
}

export class CharacterRace extends CharacterFeature {
    choices?: RaceChoice[];
    type: CharacterFeatureTypes.RACE = CharacterFeatureTypes.RACE;

    constructor(options: ICharacterOptionWithPage) {
        super(options);

        this.initialized[RaceLoadState.CHOICES] =
            this.initOptions().catch(error);
    }

    private async initOptions(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page || !this.page.content) {
            throw new Error('Could not find page content');
        }

        const subracePattern = /\n===\s*([^=]*?)\s*===\n\s*([\s\S]*?)(?===|$)/g;

        let match;

        const choices: RaceChoice[] = [
            { type: CharacterPlannerStep.SET_RACE, options: [] },
        ];

        while (true) {
            match = subracePattern.exec(this.page.content);
            if (!match) break;

            choices[0].options.push(
                new CharacterSubrace(match[1], match[2].trim()),
            );
        }

        if (choices[0].options.length) {
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

        const image = match[1].trim();

        if (image) {
            StaticImageCacheService.cacheImage(image);
        }

        return image;
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
            choices: Utils.isNonEmptyArray(this?.choices)
                ? this.choices
                : undefined,
            choiceType: Utils.isNonEmptyArray(this?.choices)
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
                this.choices[0].options.map(
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

    async isSpoiler(): Promise<boolean> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page || !this.page.content) {
            throw new Error('Could not find page content');
        }

        return this.page.content.includes('{{SpoilerWarning}}');
    }
}

let characterRaceData: CharacterRace[];

export async function getCharacterRaceData(): Promise<CharacterRace[]> {
    if (!characterRaceData) {
        const raceNames =
            await MwnApiClass.queryTitlesFromCategory('Playable races');

        const races = raceNames.map(
            (name) => new CharacterRace({ name, pageTitle: name }),
        );

        await Promise.all(races.map((cr) => cr.waitForInitialization()));

        characterRaceData = [];

        await Promise.all(
            races.map(async (race) => {
                if (!(await race.isSpoiler())) {
                    characterRaceData.push(race);
                }
            }),
        );
    }

    return characterRaceData;
}
