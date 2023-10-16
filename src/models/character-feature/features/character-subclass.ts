import { CharacterPlannerStep } from 'planner-types/src/types/character-feature-customization-option';
import { error } from '../../logger';
import { MediaWiki, PageData } from '../../media-wiki';
import { CharacterFeatureCustomizable } from '../character-feature-customizable';
import { MwnApiClass } from '../../../api/mwn';
import { CharacterSubclassFeature } from './character-subclass-feature';
import { CharacterFeatureTypes } from '../types';

enum SubclassLoadStates {
    CHOICES = 'CHOICES',
}

export class ClassSubclass extends CharacterFeatureCustomizable {
    constructor(
        public className: string,
        public featureType:
            | CharacterFeatureTypes.CHOOSE_SUBCLASS
            | CharacterFeatureTypes.SUBCLASS_FEATURE,
        public level: number,
    ) {
        super({
            name: `Subclass: ${className}`,
        });

        this.initialized[SubclassLoadStates.CHOICES] =
            this.initChoices().catch(error);
    }

    static async getSubclassData(className: string): Promise<PageData[]> {
        const allSubclassPages =
            await MwnApiClass.queryTitlesFromCategory('Subclasses');
        const allSubclasses = await Promise.all(
            allSubclassPages.map((title) => MediaWiki.getPage(title)),
        );

        return allSubclasses.filter(
            (data) => data && data.content?.includes(`{{${className}Navbox}}`),
        ) as PageData[];
    }

    private async initChoices(): Promise<void> {
        const filtered = await ClassSubclass.getSubclassData(this.className);

        this.choices = [
            {
                type:
                    this.featureType === CharacterFeatureTypes.CHOOSE_SUBCLASS
                        ? CharacterPlannerStep.CHOOSE_SUBCLASS
                        : CharacterPlannerStep.SUBCLASS_FEATURE,
                options: filtered.map(
                    (page) =>
                        new CharacterSubclassFeature(
                            {
                                name: CharacterSubclassFeature.parseNameFromPageTitle(
                                    page.title,
                                ),
                                pageTitle: page.title,
                                page,
                            },
                            this.level,
                        ),
                ),
            },
        ];

        await Promise.all(
            (
                this.choices as {
                    type: CharacterPlannerStep;
                    options: CharacterSubclassFeature[];
                }[]
            )
                .flatMap((choice) => choice.options)
                .flatMap((option) => option.waitForInitialization()),
        );
    }
}
