import { MediaWiki, PageData } from './media-wiki';

let errorCount = 0;

export enum PageLoadingState {
    PAGE_CONTENT = 'page_content',
}

export class PageItem {
    constructor(public pageTitle?: string) {
        if (pageTitle) {
            this.initialized[PageLoadingState.PAGE_CONTENT] =
                this.fetchPage().catch((e) => {
                    error(e);
                    errorCount += 1;
                    log(`ec: ${errorCount}`);
                });
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
}
