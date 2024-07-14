import { error, warn } from '../logger';
import { Utils } from '../utils';
import { MediaWikiParser } from './media-wiki-parser';
import {
    IMediaWikiTemplate,
    IPageData,
    MediaWikiTemplateParserConfig,
    MediaWikiTemplateParserConfigItem,
    TemplateParserFunction,
} from './types';

export class MediaWikiTemplate implements IMediaWikiTemplate {
    constructor(
        public wikitext: string,
        public page?: IPageData,
    ) {}

    static fromPage(
        page: IPageData & { content: string },
        templateName: string,
    ): MediaWikiTemplate[] {
        return this.getAllTemplateWikitexts(page.content, templateName, page);
    }

    static getTemplateWikitext(
        content: string,
        templateName: string,
    ): { wikitext: string; endIndex: number } | null {
        const regex = new RegExp(`{{(?:Template:)?${templateName}`, 'g');

        let depth = 0;
        let startIndex = -1;
        let endIndex = -1;

        while (true) {
            const match = regex.exec(content);

            if (!match) {
                break;
            }

            if (depth === 0) {
                startIndex = match.index;
            }

            depth += 1;

            for (let i = regex.lastIndex; i < content.length; i += 1) {
                if (content[i] === '{' && content[i + 1] === '{') {
                    depth += 1;
                    i += 1; // Skip next '{' as it's part of '}}'
                } else if (content[i] === '}' && content[i + 1] === '}') {
                    depth -= 1;
                    i += 1; // Skip next '}' as it's part of '}}'

                    if (depth === 0) {
                        endIndex = i + 1;
                        break;
                    }
                }
            }

            if (endIndex !== -1) {
                break;
            }
        }

        if (startIndex === -1 || endIndex === -1) {
            return null;
        }

        const wikitext = content.substring(startIndex, endIndex);

        return { wikitext, endIndex };
    }

    static getAllTemplateWikitexts(
        allContent: string,
        templateName: string,
        page?: IPageData,
    ): MediaWikiTemplate[] {
        let remainingContent = allContent;
        const templates: MediaWikiTemplate[] = [];

        while (true) {
            const template = this.getTemplateWikitext(
                remainingContent,
                templateName,
            );

            if (!template) {
                break;
            }

            templates.push(new MediaWikiTemplate(template.wikitext, page));
            remainingContent = remainingContent.substring(template.endIndex);
        }

        if (templates.length === 0) {
            throw new Error(
                `Failed to parse '${templateName}' template from page content.`,
            );
        }

        return templates;
    }

    static Parsers: Record<string, TemplateParserFunction> = {
        noOp: (value) => value,
        plainText: (value) =>
            value ? MediaWikiParser.stripMarkup(value) : undefined,
        int: (value: string) => {
            const parsed = parseInt(value, 10);

            return !Number.isNaN(parsed) && Number.isFinite(parsed)
                ? parsed
                : undefined;
        },
        float: (value: string) => parseFloat(value),
        boolean: (value: string) => value === 'yes',
    };

    static HighOrderParsers: Record<
        string,
        (...args: any[]) => TemplateParserFunction
    > = {
        parseEnum:
            (enumType: any) =>
            (
                value: string,
                config: MediaWikiTemplateParserConfigItem,
                page?: IPageData,
            ) => {
                if (!(value in enumType) && value !== '') {
                    const msg = `Failed to map '${config.key}' value '${value}' to enum (${page?.title}).`;

                    if (!('default' in config)) {
                        throw new Error(msg);
                    }

                    if (value.toLowerCase() in enumType) {
                        // debug(
                        //     `'${config.key}' value '${value}' was coerced to lowercase (${page?.title}).`,
                        // );

                        return enumType[value.toLowerCase()];
                    }

                    if (Utils.stringToTitleCase(value) in enumType) {
                        // debug(
                        //     `'${config.key}' value '${value}' was coerced to titlecase (${page?.title}).`,
                        // );

                        return enumType[Utils.stringToTitleCase(value)];
                    }

                    warn(msg);
                }

                return enumType[value];
            },
    };

    protected parseValue(key: string): string | undefined {
        const regex = new RegExp(
            `\\|\\s*${key}\\s*=([\\s\\S]*?)\\n(?:\\||}})`,
            'i',
        );

        let { wikitext } = this;

        // Add line breaks to the template text ONLY if there are no line breaks already
        // We want to avoid adding line breaks to nested templates, so we'll only add them if they don't already exist
        // The compromise we're making here is only being able to properly
        // parse nested templates IF they have line breaks in the original wikitext
        if (!wikitext.includes('\n')) {
            wikitext = wikitext
                .replace(/(\|)/g, '\n$1')
                .replace(/(}})$/g, '\n$1');
        }

        const match = wikitext.match(regex);

        return match ? match[1].trim() : undefined;
    }

    parse(config: MediaWikiTemplateParserConfig): Record<string, any> {
        return Object.fromEntries(
            Object.entries(config).map(([prop, baseConfig]) => {
                const itemConfig = { key: prop, ...baseConfig };

                const value = this.parseValue(itemConfig.key);

                if (typeof value === 'undefined' || value === null) {
                    if (!('default' in itemConfig)) {
                        error(
                            `Failed to parse '${prop}' from page '${this.page?.title}' and no default value was specified.`,
                        );
                    }

                    return [prop, itemConfig.default];
                }

                return [
                    prop,
                    itemConfig.parser
                        ? itemConfig.parser(value, itemConfig, this.page)
                        : value,
                ];
            }),
        );
    }
}
