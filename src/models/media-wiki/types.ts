import { ApiRevision } from 'mwn';

export interface IPageData extends ApiRevision {
    title: string;
    revisionId: any;
    categories: string[];
    pageId: number;
    lastFetched: number;
    content: string;

    hasCategory(categoryNames: string[] | string): boolean;
    hasTemplate(templateNames: string[] | string): Promise<boolean>;
    getTemplate(templateName: string): Promise<IMediaWikiTemplate>;
    getSection(
        nameOrRegex: string,
        depth?: number,
    ): { title: string; content: string } | null;
}

export interface IMediaWikiTemplate {
    wikitext: string;
    parseWikitextFromPage(templateName: string): string;
    parse(config: MediaWikiTemplateParserConfig): Record<string, any>;
}

export type TemplateParserFunction = (
    value: string,
    config: MediaWikiTemplateParserConfigItem,
    page: IPageData,
) => any;

export interface MediaWikiTemplateParserConfigItem {
    key?: string;
    parser?: TemplateParserFunction;
    default?: any;
}

export type MediaWikiTemplateParserConfig = Record<
    string,
    MediaWikiTemplateParserConfigItem
>;
