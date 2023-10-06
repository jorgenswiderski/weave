import { error, log } from './logger';
import { MediaWiki, PageData } from './media-wiki';

let errorCount = 0;

export class PageItem {
    constructor(public pageTitle?: string) {
        if (pageTitle) {
            this.fetchPage().catch((e) => {
                error(e);
                errorCount += 1;
                log(`ec: ${errorCount}`);
            });
        }
    }

    page?: PageData;
    pageHasLoaded?: Promise<PageData | null>;

    async fetchPage(): Promise<void> {
        if (!this.pageTitle) {
            return;
        }

        this.pageHasLoaded = MediaWiki.getPage(this.pageTitle);
        const data = await this.pageHasLoaded;

        if (!data) {
            return;
        }

        this.page = data;
    }
}
