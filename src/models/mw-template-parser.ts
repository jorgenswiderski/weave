import { MediaWiki, PageData } from './media-wiki';
import { PageNotFoundError } from './errors';
import { error } from './logger';

type ParserFunction = (
    value: string,
    config: MediaWikiTemplateParserConfig,
) => any;

export interface MediaWikiTemplateParserConfig {
    key?: string;
    parser?: ParserFunction;
    default?: any;
}

export class MediaWikiTemplateParser {
    static Parsers: Record<string, ParserFunction> = {
        image: (value) => (value ? MediaWiki.getImagePath(value) : undefined),
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
            (value: string, config: MediaWikiTemplateParserConfig) => {
                if (!('default' in config) && !(value in enumType)) {
                    throw new Error(
                        `Failed to map '${config.key}' value '${value}' to enum.`,
                    );
                }

                return enumType[value];
            },
    };

    static parseValueFromWikiTemplate(
        wikitext: string,
        key: string,
    ): string | undefined {
        const commentless = wikitext.replace(/<!--[\s\S]*?-->/g, '');
        const regex = new RegExp(`\\|\\s*${key}\\s*=(.*?)\\n\\|`, 'i');
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
                const itemConfig = { ...baseConfig, key: prop };

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
                        ? itemConfig.parser(value, itemConfig)
                        : value,
                ];
            }),
        );
    }
}