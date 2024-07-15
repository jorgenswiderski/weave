import { Utils } from '../utils';
import { MediaWikiTemplate } from './media-wiki-template';
import { IPageData } from './types';

export class MediaWikiText {
    // getPage is initialized in the MediaWiki class to resolve circular dependencies
    // would prefer to define IMediaWiki, however this is a static method
    static MediaWiki: {
        getPage: (
            pageTitle: string,
            revisionId?: number,
            allowRedirect?: boolean,
        ) => Promise<IPageData>;
    } = {} as any;

    constructor(
        public text: string,
        public page?: IPageData,
    ) {}

    protected static async getTemplatePage(
        templateName: string,
    ): Promise<IPageData> {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return this.MediaWiki.getPage(
            `${
                templateName.startsWith('User:') ? '' : 'Template:'
            }${templateName}`,
        );
    }

    protected static getTemplateId = Utils.memoize(async function getTemplateId(
        templateName: string,
    ): Promise<number> {
        const { pageId } = await MediaWikiText.getTemplatePage(templateName);

        return pageId;
    });

    static magicWords = [
        /^#[^|}]+:/, // Some magic words (parser functions?) start with an octothorpe
        /^[lu]c(?:first)?:/i, // Casing formatter https://www.mediawiki.org/wiki/Help:Magic_words/en#Formatting
    ];

    static uppercaseExceptions = ['SAI'];

    protected getRawTemplateNames(): string[] {
        const allTemplateNames = [
            ...this.text.matchAll(
                /(?<=[^{]|^){{(?:Template:)?([^|{}]+)[\s\S]*?}}/g,
            ),
        ]
            .map((match) => match[1].trim())
            // filter out "magic words" like "{{DISPLAYTITLE}}" which aren't templates
            // https://www.mediawiki.org/wiki/Help:Magic_words/en
            .filter((name) => {
                if (MediaWikiText.uppercaseExceptions.includes(name)) {
                    return true;
                }

                // Many magic words are in upper case, filter out matches which are in all uppercase
                const varName = name.split(':')[0];

                return varName !== varName.toUpperCase();
            })
            .filter((name) =>
                MediaWikiText.magicWords.every((regexp) => !name.match(regexp)),
            );

        return Array.from(new Set(allTemplateNames));
    }

    static templateCache: Map<number, Set<number>> = new Map();

    async hasTemplate(templateNames: string[] | string): Promise<boolean> {
        const key = this.page?.pageId;

        // eslint-disable-next-line no-param-reassign
        templateNames =
            typeof templateNames === 'string' ? [templateNames] : templateNames;

        let pageTemplateIds: Set<number>;

        if (key && MediaWikiText.templateCache.has(key)) {
            pageTemplateIds = MediaWikiText.templateCache.get(key)!;
        } else {
            const templateIds = await Promise.all(
                this.getRawTemplateNames().map(MediaWikiText.getTemplateId),
            );

            pageTemplateIds = new Set(templateIds);

            if (key) {
                MediaWikiText.templateCache.set(key, pageTemplateIds);
            }
        }

        const searchTemplateIds = await Promise.all(
            templateNames.map(MediaWikiText.getTemplateId),
        );

        return searchTemplateIds.some((id) => pageTemplateIds.has(id));
    }

    static async hasTemplate(
        text: string,
        templateNames: string[] | string,
        page?: IPageData & { content: string },
    ): Promise<boolean> {
        return new MediaWikiText(text, page).hasTemplate(templateNames);
    }

    protected async getTemplateInternal(
        templateName: string,
        matchAll?: undefined,
    ): Promise<MediaWikiTemplate>;
    protected async getTemplateInternal(
        templateName: string,
        matchAll: true,
    ): Promise<MediaWikiTemplate[]>;
    protected async getTemplateInternal(
        templateName: string,
        matchAll: true | undefined,
    ): Promise<MediaWikiTemplate | MediaWikiTemplate[]> {
        const templateId = await MediaWikiText.getTemplateId(templateName);
        const rawPageTemplateNames = this.getRawTemplateNames();

        const matchingTemplate = await Utils.asyncFilter(
            rawPageTemplateNames,
            async (name) =>
                (await MediaWikiText.getTemplateId(name)) === templateId,
        );

        const identifier = this.page ? `page '${this.page.title}'` : 'wikitext';

        if (matchingTemplate.length === 0) {
            throw new Error(
                `Could not find template '${templateName}' in ${identifier}`,
            );
        }

        if (matchingTemplate.length > 1) {
            throw new Error(
                `Found ${matchingTemplate.length} templates matching template '${templateName}' in ${identifier}`,
            );
        }

        const matchingTemplateName = matchingTemplate[0];

        const templates = this.page
            ? MediaWikiTemplate.fromPage(this.page, matchingTemplateName)
            : MediaWikiTemplate.getAllTemplateWikitexts(
                  this.text,
                  templateName,
              );

        if (!matchAll && templates.length > 1) {
            throw new Error(
                `Found more than 1 'Template:${matchingTemplateName}' when parsing ${identifier}, but only expected 1!`,
            );
        }

        if (matchAll) {
            return templates;
        }

        return templates[0];
    }

    async getTemplate(templateName: string): Promise<MediaWikiTemplate> {
        return this.getTemplateInternal(templateName);
    }

    static async getTemplate(
        text: string,
        templateName: string,
        page?: IPageData,
    ): Promise<MediaWikiTemplate> {
        return new MediaWikiText(text, page).getTemplate(templateName);
    }

    async getTemplates(templateName: string): Promise<MediaWikiTemplate[]> {
        return this.getTemplateInternal(templateName, true);
    }

    static async getTemplates(
        text: string,
        templateName: string,
        page?: IPageData,
    ): Promise<MediaWikiTemplate[]> {
        return new MediaWikiText(text, page).getTemplates(templateName);
    }
}
