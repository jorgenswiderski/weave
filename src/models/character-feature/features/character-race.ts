import {
    CharacterPlannerStep,
    ICharacterOptionWithStubs,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { GrantableEffect } from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import assert from 'assert';
import { error } from '../../logger';
import { MediaWiki } from '../../media-wiki/media-wiki';
import { PageLoadingState } from '../../page-item';
import { CharacterFeatureTypes, ICharacterOptionWithPage } from '../types';
import { CharacterSubrace } from './character-subrace';
import { CharacterFeature } from '../character-feature';
import { Utils } from '../../utils';
import { StaticImageCacheService } from '../../static-image-cache-service';
import { MediaWikiParser } from '../../media-wiki/media-wiki-parser';
import { IPageSection } from '../../media-wiki/types';

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

    private async initOptions(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            throw new Error('Could not find page content');
        }

        if (await this.isSpoiler()) {
            return;
        }

        const featuresSection = this.page.getSection('Racial features');

        assert(
            featuresSection,
            `Failed to find 'Racial features' for race '${this.name}'`,
        );

        const subraceSections = featuresSection.getSubsections('[^=]+?', 3);

        const options = subraceSections.map(
            (section) => new CharacterSubrace(section),
        );

        await Promise.all(
            options.map((option) => option.waitForInitialization()),
        );

        if (options.length) {
            this.choices = [
                { type: CharacterPlannerStep.CHOOSE_SUBRACE, options },
            ];
        }
    }

    async initImage(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page || !this.page.content) {
            throw new Error('Could not find page content');
        }

        const regex = /\[\[File\s*:\s*([^|\]]+).*|right]]/m;
        const match = regex.exec(this.page.content);

        if (!match || !match[1]) {
            return;
        }

        const image = match[1].trim();
        StaticImageCacheService.cacheImage(image);
        this.image = image;
    }

    async initDescription(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page || !this.page.content) {
            throw new Error('Could not find page content');
        }

        const descPattern =
            /==\s*About\s(?:the\s)?[\w-]+?\s*==\n+([\s\S]+?)\n+=/;

        const match = this.page.content.match(descPattern);

        if (!match || !match[1]) {
            const description = await super.getDescription();

            this.description = Utils.stringToSentences(description)
                .filter(
                    (sentence) => !sentence.match(/(is|are) a playable race/i),
                )
                .join('');

            return;
        }

        this.description = MediaWikiParser.stripMarkup(match[1])
            .trim()
            .split('\n')[0];
    }

    protected async parseRacialFeatures(features: IPageSection): Promise<void> {
        const excludingSubsections = features.content.split(/\n=/)[0];

        const fx = await CharacterRace.parseFeatures(excludingSubsections);

        this.grants.push(...fx);
    }

    async initOptionsAndEffects(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            throw new Error('could not find page content');
        }

        const featuresSection = this.page.getSection('Racial features');

        if (featuresSection) {
            await this.parseRacialFeatures(featuresSection);
        } else {
            error(`Could not find racial features for race '${this.name}'.`);
        }
    }

    async isSpoiler(): Promise<boolean> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page || !this.page.content) {
            throw new Error('Could not find page content');
        }

        return this.page.hasTemplate('SpoilerWarning');
    }

    toJSON() {
        const { name, description, image, choices, grants } = this;

        return {
            name,
            description,
            choices: Utils.isNonEmptyArray(choices) ? choices : undefined,
            choiceType: Utils.isNonEmptyArray(choices)
                ? CharacterPlannerStep.CHOOSE_SUBRACE
                : undefined,
            image,
            grants,
        };
    }
}

let characterRaceData: CharacterRace[];

export async function getCharacterRaceData(): Promise<CharacterRace[]> {
    if (!characterRaceData) {
        const raceNames = await MediaWiki.getTitlesInCategories([
            'Playable races',
        ]);

        const races = raceNames.map(
            (name) => new CharacterRace({ name, pageTitle: name }),
        );

        await Promise.all(races.map((cr) => cr.waitForInitialization()));

        characterRaceData = await Utils.asyncFilter(
            races,
            async (race) => !(await race.isSpoiler()),
        );
    }

    return characterRaceData;
}
