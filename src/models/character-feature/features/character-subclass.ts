import { CharacterPlannerStep } from 'planner-types/src/types/character-feature-customization-option';
import { error } from '../../logger';
import { MediaWiki, PageData } from '../../media-wiki';
import { CharacterFeatureCustomizable } from '../character-feature-customizable';
import { MwnApi } from '../../../api/mwn';
import { CharacterFeatureWithIntroDescription } from '../character-feature-with-intro-description';

enum SubclassLoadStates {
    CHOICES = 'CHOICES',
}

export class ClassSubclass extends CharacterFeatureCustomizable {
    constructor(public className: string) {
        super({
            name: `Subclass: ${className}`,
            choiceType: CharacterPlannerStep.CHOOSE_SUBCLASS,
        });

        this.initialized[SubclassLoadStates.CHOICES] =
            this.initChoices().catch(error);
    }

    private async initChoices(): Promise<void> {
        const allSubclassPages =
            await MwnApi.queryTitlesFromCategory('Subclasses');
        const allSubclasses = await Promise.all(
            allSubclassPages.map((title) => MediaWiki.getPage(title)),
        );

        const filtered = allSubclasses.filter(
            (data) =>
                data && data.content?.includes(`{{${this.className}Navbox}}`),
        ) as PageData[];

        this.choices = [
            filtered.map(
                (page) =>
                    new CharacterFeatureWithIntroDescription(page.title, page),
            ),
        ];
    }
}
