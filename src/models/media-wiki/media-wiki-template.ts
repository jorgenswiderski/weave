import { error, warn } from '../logger';
import { Utils } from '../utils';
import { MediaWikiParser } from './wikitext-parser';
import {
    IMediaWikiTemplate,
    IPageData,
    MediaWikiTemplateParserConfig,
    MediaWikiTemplateParserConfigItem,
    TemplateParserFunction,
} from './types';

export class MediaWikiTemplate implements IMediaWikiTemplate {
    wikitext: string;

    constructor(
        public page: IPageData & { content: string },
        templateName: string,
    ) {
        this.wikitext = this.parseWikitextFromPage(templateName);
    }

    parseWikitextFromPage(templateName: string): string {
        const regex = new RegExp(`{{(?:Template:)?${templateName}`, 'g');

        const commentless = MediaWikiParser.removeComments(this.page.content);
        let depth = 0;
        let startIndex = -1;
        let endIndex = -1;

        while (true) {
            const match = regex.exec(commentless);

            if (!match) {
                break;
            }

            if (depth === 0) {
                startIndex = match.index;
            }

            depth += 1;

            for (let i = regex.lastIndex; i < commentless.length; i += 1) {
                if (commentless[i] === '{' && commentless[i + 1] === '{') {
                    depth += 1;
                    i += 1; // Skip next '{' as it's part of '}}'
                } else if (
                    commentless[i] === '}' &&
                    commentless[i + 1] === '}'
                ) {
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
            throw new Error(
                `Failed to parse '${templateName}' template from page content.`,
            );
        }

        const wikitext = commentless.substring(startIndex, endIndex);

        return wikitext;
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
                page: IPageData,
            ) => {
                if (!(value in enumType) && value !== '') {
                    const msg = `Failed to map '${config.key}' value '${value}' to enum (${page.title}).`;

                    if (!('default' in config)) {
                        throw new Error(msg);
                    }

                    if (value.toLowerCase() in enumType) {
                        // debug(
                        //     `'${config.key}' value '${value}' was coerced to lowercase (${page.title}).`,
                        // );

                        return enumType[value.toLowerCase()];
                    }

                    if (Utils.stringToTitleCase(value) in enumType) {
                        // debug(
                        //     `'${config.key}' value '${value}' was coerced to titlecase (${page.title}).`,
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

        const match = this.wikitext.match(regex);

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
                            `Failed to parse '${prop}' from page '${this.page.title}' and no default value was specified.`,
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
