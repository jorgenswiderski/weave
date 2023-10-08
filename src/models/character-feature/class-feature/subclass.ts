import { error } from '../../logger';
import { MediaWiki, PageData } from '../../media-wiki';
import { CharacterFeatureCustomizable } from '../character-feature-customizable';
import { CharacterFeatureTypes } from '../types';
import { MwnApi } from '../../../api/mwn';
import { CharacterFeatureCustomizationOption } from '../feature-customization-option/feature-customization-option';
import { IClassSubclass } from './types';

enum SubclassLoadStates {
    DATA = 'DATA',
}

export class ClassSubclass
    extends CharacterFeatureCustomizable
    implements IClassSubclass
{
    constructor(public className: string) {
        super({ type: CharacterFeatureTypes.CHOOSE_SUBCLASS });

        this.initialized[SubclassLoadStates.DATA] =
            this.fetchSubclasses().catch(error);
    }

    private async fetchSubclasses(): Promise<void> {
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
                    new CharacterFeatureCustomizationOption(
                        page.title.split('(')[0].trim(),
                        page.title,
                        page,
                    ),
            ),
        ];
    }
}
