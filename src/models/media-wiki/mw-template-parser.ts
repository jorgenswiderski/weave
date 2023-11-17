import { MediaWiki, PageData } from './media-wiki';
import { PageNotFoundError } from '../errors';
import { error, warn } from '../logger';
import { Utils } from '../utils';
import { MediaWikiParser } from './wikitext-parser';

type ParserFunction = (
    value: string,
    config: MediaWikiTemplateParserConfig,
    page: PageData,
) => any;

export interface MediaWikiTemplateParserConfig {
    key?: string;
    parser?: ParserFunction;
    default?: any;
}

export class MediaWikiTemplateParser {
    static Parsers: Record<string, ParserFunction> = {
        noOp: (value) => value,
        plainText: (value) =>
            value ? MediaWiki.stripMarkup(value) : undefined,
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
        (...args: any[]) => ParserFunction
    > = {
        parseEnum:
            (enumType: any) =>
            (
                value: string,
                config: MediaWikiTemplateParserConfig,
                page: PageData,
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

    static parseValueFromWikiTemplate(
        wikitext: string,
        key: string,
    ): string | undefined {
        const commentless = MediaWikiParser.removeComments(wikitext);

        const regex = new RegExp(
            `\\|\\s*${key}\\s*=([\\s\\S]*?)\\n(?:\\||}})`,
            'i',
        );

        const match = commentless.match(regex);

        return match ? match[1].trim() : undefined;
    }

    static parseTemplate(
        page: PageData,
        config: Record<string, MediaWikiTemplateParserConfig>,
    ): Record<string, any> {
        if (!page.content) {
            throw new PageNotFoundError();
        }

        const { content } = page;

        return Object.fromEntries(
            Object.entries(config).map(([prop, baseConfig]) => {
                const itemConfig = { key: prop, ...baseConfig };

                const value =
                    MediaWikiTemplateParser.parseValueFromWikiTemplate(
                        content,
                        itemConfig.key,
                    );

                if (typeof value === 'undefined' || value === null) {
                    if (!('default' in itemConfig)) {
                        error(
                            `Failed to parse '${prop}' from page '${page.title}' and no default value was specified.`,
                        );
                    }

                    return [prop, itemConfig.default];
                }

                return [
                    prop,
                    itemConfig.parser
                        ? itemConfig.parser(value, itemConfig, page)
                        : value,
                ];
            }),
        );
    }
}
