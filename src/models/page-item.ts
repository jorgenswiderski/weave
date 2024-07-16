import { error } from './logger';
import { MediaWiki, PageData } from './media-wiki/media-wiki';
import { Utils } from './utils';
import { WikiLoadable } from './wiki-loadable';

export enum PageLoadingState {
    PAGE_CONTENT = 'page_content',
}

export class PageItem extends WikiLoadable {
    pageTitle?: string;
    page?: PageData;

    constructor({ pageTitle, page }: { pageTitle?: string; page?: PageData }) {
        super();

        this.pageTitle = pageTitle;
        this.page = page;

        if (pageTitle) {
            if (!page?.content) {
                this.initialized[PageLoadingState.PAGE_CONTENT] =
                    this.fetchPage().catch(error);
            } else {
                this.initialized[PageLoadingState.PAGE_CONTENT] =
                    Utils.resolvedPromise;
            }
        }
    }

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
            throw new Error(`Page '${this.pageTitle}' intro is null`);
        }

        return intro.split('\n')[0].trim();
    }
}
