import { error } from './logger';
import { MediaWiki, PageData } from './media-wiki';

export enum PageLoadingState {
    PAGE_CONTENT = 'page_content',
}

export class PageItem {
    constructor(public pageTitle?: string) {
        if (pageTitle) {
            this.initialized[PageLoadingState.PAGE_CONTENT] =
                this.fetchPage().catch(error);
        }
    }

    page?: PageData;
    initialized: Record<string, Promise<any>> = {};

    async fetchPage(): Promise<void> {
        if (!this.pageTitle) {
            return;
        }

        const data = await MediaWiki.getPage(this.pageTitle);

        if (!data) {
            return;
        }

        this.page = data;
    }

    protected async getDescription(): Promise<string> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.pageTitle) {
            throw new Error('No page title!');
        }

        const intro = await MediaWiki.getTextExtract(this.pageTitle, {
            intro: true,
        });

        if (!intro) {
            throw new Error('Page intro is null');
        }

        return intro.split('\n')[0].trim();
    }
}
