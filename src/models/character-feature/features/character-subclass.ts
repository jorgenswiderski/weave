import { GrantableEffect } from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import {
    CharacterPlannerStep,
    ICharacterChoiceWithStubs,
    ICharacterOptionWithStubs,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { StaticallyReferenceable } from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/types';
import { PageLoadingState } from '../../page-item';
import { CharacterFeature } from '../character-feature';
import { CharacterProgressionLevel } from '../../character-class/types';
import { ICharacterOptionWithPage } from '../types';
import { PageNotFoundError } from '../../errors';
import { StaticImageCacheService } from '../../static-image-cache-service';
import { MediaWikiParser } from '../../media-wiki/wikitext-parser';

export class CharacterSubclass extends CharacterFeature {
    constructor(
        option: ICharacterOptionWithPage,
        public level: number,
    ) {
        super(option, level);
    }

    async initDescription(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            return;
        }

        const descMatch = /{{SubclassQuote\|quote=(.+?)\|image/g;
        const match = descMatch.exec(this.page.content);

        if (!match?.[1]) {
            throw new Error('could not initialize subclass description');
        }

        this.description = MediaWikiParser.stripMarkup(match[1]).trim();
    }

    async initImage(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            return;
        }

        const imageMatch = /{{SubclassQuote\|quote=.+?\|image=([^|}]+)[|}]+/g;
        const match = imageMatch.exec(this.page.content);

        if (!match?.[1]) {
            throw new Error('could not initialize subclass image');
        }

        this.image = match[1];

        if (this.image) {
            StaticImageCacheService.cacheImage(this.image);
        }
    }

    protected async getLevelOption(
        content: string,
        // level: number,
    ): Promise<ICharacterOptionWithStubs> {
        const sectionMatches = [
            ...content.matchAll(
                /\s*={4,}\s*(.*?)\s*={4,}\s*\n([\s\S]*?)(?=(?:\n\s*====)|$)/g,
            ),
        ];

        const choiceSections = sectionMatches.filter(([, , sectionContent]) => {
            const match = sectionContent.match(
                /{\|\s*class=("wikitable.*?"|wikitable)[\s\S]+?\|}/,
            );

            if (match) {
                // eslint-disable-next-line no-param-reassign
                content = content.replace(match[0], '');

                return true;
            }

            return false;
        });

        const choices = await Promise.all(
            choiceSections.map(async ([, sectionTitle, sectionContent]) => {
                const options = await this.parseChoiceList(
                    sectionContent,
                    sectionTitle,
                );

                const choice: ICharacterChoiceWithStubs = {
                    type: CharacterPlannerStep.CLASS_FEATURE_SUBCHOICE,
                    options,
                };

                return choice;
            }),
        );

        const saiPattern = /{{SAI\|([^|}]+?)(?:\|[^}]*?)?}}/g;
        const iconPattern = /{{IconLink\|[^|]+\|([^|}]+?)(?:\|[^}]*?)?}}/g;

        const featureTitles = [
            ...content.matchAll(saiPattern),
            ...content.matchAll(iconPattern),
        ].map((match) => match[1]);

        const grants = (
            await Promise.all(
                featureTitles.map((title) =>
                    CharacterFeature.parsePageForGrantableEffect(title),
                ),
            )
        ).filter(Boolean) as (GrantableEffect | StaticallyReferenceable)[];

        return {
            name: `${this.name} (Level ${this.level})`,
            grants,
            choices,
        };
    }

    async getProgression(): Promise<CharacterProgressionLevel[]> {
        if (!this.page?.content) {
            throw new Error('Could not find page content');
        }

        const featureSection =
            /\n\s*==\s*Subclass\sFeatures\s*==\s*\n([\s\S]*?)(?=\n\s*==\s*[^=]+?\s*==\s*\n|{{\w+Navbox}})/i;

        const sectionMatch = featureSection.exec(this.page.content);
        const subclassFeatureLevels: number[] = [];

        if (!sectionMatch?.[1]) {
            throw new Error(
                `Could not find subclass features for ${this.name}`,
            );
        }

        const levelSection =
            /\n===\s*Level\s(\d+)\s*===\s*\n([\s\S]*?)(?=\n===\s*Level|$)/gi;

        const levelMatches = [...sectionMatch[1].matchAll(levelSection)];

        const progression: CharacterProgressionLevel[] = Array.from({
            length: 12,
        }).map((a, index) => ({
            Level: index + 1,
            Features: [],
        }));

        await Promise.all(
            levelMatches.map(async ([, levelStr, content]) => {
                const level = parseInt(levelStr, 10);
                subclassFeatureLevels.push(level);
                const option = await this.getLevelOption(content);
                progression[level - 1].Features.push(option);
            }),
        );

        return progression;
    }

    async getEffectsByLevel(
        level: number,
    ): Promise<ICharacterOptionWithStubs[]> {
        const progression = await this.getProgression();

        return progression[level - 1].Features;
    }

    async initOptionsAndEffects(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page) {
            throw new PageNotFoundError();
        }

        const levelEffects = await this.getEffectsByLevel(this.level);

        const effects = levelEffects.flatMap((option) => option.grants ?? []);

        if (effects.length > 0) {
            this.grants = effects;
        }

        const choices = levelEffects.flatMap((option) => option.choices ?? []);

        if (choices.length > 0) {
            this.choices = choices;
        }
    }
}
