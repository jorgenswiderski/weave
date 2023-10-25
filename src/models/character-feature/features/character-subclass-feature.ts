import { GrantableEffect } from 'planner-types/src/types/grantable-effect';
import { ICharacterOption } from 'planner-types/src/types/character-feature-customization-option';
import { PageLoadingState } from '../../page-item';
import { CharacterFeature } from '../character-feature';
import { CharacterProgressionLevel } from '../../character-class/types';
import { ICharacterOptionWithPage } from '../types';
import { MediaWiki, PageData } from '../../media-wiki';
import { PageNotFoundError } from '../../errors';

export class CharacterSubclassFeature extends CharacterFeature {
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

        this.description = MediaWiki.stripMarkup(match[1]).trim();
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
    }

    static async getProgression(
        page: PageData,
    ): Promise<CharacterProgressionLevel[]> {
        if (!page?.content) {
            throw new Error('Could not find page content');
        }

        const featureSection =
            /\n==\s*Subclass\s[fF]eatures\s*==\s*\n([\s\S]*?)(?=\n==\s*[^=]+?\s*==\s*\n|{{\w+Navbox}})/;

        const sectionMatch = featureSection.exec(page.content);
        const subclassFeatureLevels: number[] = [];

        if (!sectionMatch?.[1]) {
            throw new Error(
                `Could not find subclass features for ${this.name}`,
            );
        }

        const levelSection =
            /\n===\s*Level\s(\d+)\s*===\s*\n([\s\S]*?)(?=\n===\s*Level|$)/g;
        const levelMatches = [...sectionMatch[1].matchAll(levelSection)];

        const progression: CharacterProgressionLevel[] = Array.from({
            length: 12,
        }).map((a, index) => ({
            Level: index + 1,
            Features: [],
        }));

        const effectsByLevel = await Promise.all(
            levelMatches.map(async (levelContent) => {
                const level = parseInt(levelContent[1], 10);
                subclassFeatureLevels.push(level);

                const saiPattern = /{{SAI\|([^|}]+?)(?:\|[^}]*?)?}}/g;
                const iconPattern =
                    /{{IconLink\|[^|]+\|([^|}]+?)(?:\|[^}]*?)?}}/g;

                const pageTitleMatches = [
                    ...levelContent[2].matchAll(saiPattern),
                    ...levelContent[2].matchAll(iconPattern),
                ];

                return [
                    level,
                    (
                        await Promise.all(
                            pageTitleMatches.map(async (match) => {
                                const effect =
                                    await CharacterFeature.parsePageForGrantableEffect(
                                        match[1],
                                    );

                                return effect
                                    ? {
                                          name: match[1],
                                          grants: [effect],
                                      }
                                    : undefined;
                            }),
                        )
                    ).filter(Boolean) as unknown as ICharacterOption[],
                ];
            }),
        );

        effectsByLevel.forEach(([level, fx]) =>
            progression[(level as number) - 1].Features.push(
                ...(fx as unknown as ICharacterOption[]),
            ),
        );

        return progression;
    }

    static async getEffectsByLevel(
        page: PageData,
        level: number,
    ): Promise<GrantableEffect[]> {
        const progression = await CharacterSubclassFeature.getProgression(page);

        return progression[level - 1].Features.flatMap(
            (feature) => feature.grants,
        ).filter(Boolean) as unknown as GrantableEffect[];
    }

    async initGrantableEffects(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page) {
            throw new PageNotFoundError();
        }

        this.grants = await CharacterSubclassFeature.getEffectsByLevel(
            this.page,
            this.level,
        );
    }
}
