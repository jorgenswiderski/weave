import { CharacterPlannerStep } from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { error } from '../../logger';
import { MediaWiki, PageData } from '../../media-wiki/media-wiki';
import { CharacterFeatureCustomizable } from '../character-feature-customizable';
import { CharacterSubclass } from './character-subclass/character-subclass';
import { MediaWikiParser } from '../../media-wiki/media-wiki-parser';
import { ICharacterClass } from '../../character-class/types';

enum SubclassLoadStates {
    CHOICES = 'CHOICES',
}

export class ClassSubclassOption extends CharacterFeatureCustomizable {
    constructor(
        public characterClass: ICharacterClass,
        public type:
            | CharacterPlannerStep.CHOOSE_SUBCLASS
            | CharacterPlannerStep.SUBCLASS_FEATURE,
        public level: number,
    ) {
        super({
            name: `Subclass${
                type === CharacterPlannerStep.SUBCLASS_FEATURE ? ' Feature' : ''
            }: ${characterClass.name}`,
        });

        this.initialized[SubclassLoadStates.CHOICES] =
            this.initChoices().catch(error);
    }

    static async getSubclassData(className: string): Promise<PageData[]> {
        const allSubclassPages = await MediaWiki.getTitlesInCategories([
            'Subclasses',
        ]);

        const allSubclasses = await Promise.all(
            allSubclassPages.map((title) => MediaWiki.getPage(title)),
        );

        return allSubclasses.filter(
            (data) => data && data.content?.includes(`{{${className}Navbox}}`),
        ) as PageData[];
    }

    private async initChoices(): Promise<void> {
        const filtered = await ClassSubclassOption.getSubclassData(
            this.characterClass.name,
        );

        this.choices = [
            {
                type: this.type,
                options: filtered.map(
                    (page) =>
                        new CharacterSubclass(
                            {
                                name: MediaWikiParser.parseNameFromPageTitle(
                                    page.title,
                                ),
                                pageTitle: page.title,
                                page,
                            },
                            this.level,
                            this.characterClass,
                        ),
                ),
            },
        ];

        await Promise.all(
            (
                this.choices as {
                    type: CharacterPlannerStep;
                    options: CharacterSubclass[];
                }[]
            )
                .flatMap((choice) => choice.options)
                .flatMap((option) => option.waitForInitialization()),
        );
    }
}
