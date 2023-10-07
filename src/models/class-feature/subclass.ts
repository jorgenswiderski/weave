import { error } from '../logger';
import { MediaWiki, PageData } from '../media-wiki';
import { ClassFeatureCustomizable } from './class-feature-customizable';
import { ClassFeatureTypes, IClassSubclass } from './types';
import { MwnApi } from '../../api/mwn';

enum SubclassLoadStates {
    DATA = 'DATA',
}

export class ClassSubclass
    extends ClassFeatureCustomizable
    implements IClassSubclass
{
    constructor(public className: string) {
        super({ type: ClassFeatureTypes.CHOOSE_SUBCLASS });

        this.initialized[SubclassLoadStates.DATA] =
            this.fetchSubclasses().catch(error);
    }

    private async fetchSubclasses(): Promise<void> {
        const allSubclassPages =
            await MwnApi.fetchTitlesFromCategory('Subclasses');
        const allSubclasses = await Promise.all(
            allSubclassPages.map((title) => MediaWiki.getPage(title)),
        );

        const filtered = allSubclasses.filter(
            (data) =>
                data && data.content?.includes(`{{${this.className}Navbox}}`),
        );

        this.choices = [
            filtered.map((page) => ({
                name: page?.title || 'no name', // FIXME
                pageTitle: page?.title,
                page: page as PageData,
            })),
        ];
    }
}
