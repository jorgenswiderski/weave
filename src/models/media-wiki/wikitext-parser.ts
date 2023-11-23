import { WikitableNotFoundError } from './types';

type TableRow = Record<string, string>;

type WikitableMarkup = 'start' | 'caption' | 'row' | 'header' | 'cell' | 'end';

export class MediaWikiParser {
    static getAllPageTitles(wikitext: string): string[] {
        const pageTitleMatch = /\[\[([^#|\]]+).*?]]/g;
        const coordsTemplateMatch = /{{Coords\|-?\d+\|-?\d+\|([^}]+)}}/g;

        return [
            ...wikitext.matchAll(pageTitleMatch),
            ...wikitext.matchAll(coordsTemplateMatch),
        ].map((match) => match[1]);
    }

    static titleSuffixWhitelist = new Set([
        'melee',
        'ranged',
        'unarmed',

        // wildheart aspects
        'bear',
        'chimpanzee',
        'crocodile',
        'eagle',
        'elk',
        'honey badger',
        'stallion',
        'tiger',
        'wolf',
        'wolverine',

        // dragonborn breath / draconic bloodline ancestries
        'acid',
        'fire',
        'poison',
        'cold',
        'lightning',
    ]);

    static parseNameFromPageTitle(title: string) {
        const match = title.match(/(.*)\s*\((.*)\)/);

        if (!match) {
            return title;
        }

        if (this.titleSuffixWhitelist.has(match[2].toLowerCase())) {
            return title;
        }

        return match[1].trim();
    }

    static removeComments(wikitext: string): string {
        return wikitext.replace(/<!--[\s\S]*?-->/g, '');
    }

    protected static parseWikiTableCell(wikitext: string): string {
        const match = wikitext.match(/\s*(?:style=".+?"\s*\|)?\s*([\s\S]+)\s*/);

        if (!match?.[1]) {
            throw new Error();
        }

        return match[1].trim();
    }

    static parseWikiTable(sectionWikitext: string): Record<string, string>[];
    static parseWikiTable(sectionWikitext: string, format: '2d'): string[][];
    static parseWikiTable(
        sectionWikitext: string,
        format: 'record',
    ): Record<string, string>[];
    static parseWikiTable(
        sectionWikitext: string,
        format: 'both',
    ): Record<number | string, string>[];
    static parseWikiTable(
        sectionWikitext: string,
        format: 'record' | '2d' | 'both' = 'record',
    ): Record<string, string>[] | string[][] {
        const match = sectionWikitext.match(
            /{\|\s*class=("wikitable.*?"|wikitable)[\s\S]+?\|}/,
        );

        if (!match) {
            throw new WikitableNotFoundError();
        }

        const wikitext = match[0];

        type MarkupInfo = {
            delimiter: string;
            delimiterMidline?: string;
            hasContent?: true;
        };

        const mu: Record<WikitableMarkup, MarkupInfo> = {
            start: { delimiter: '{|' },
            caption: { delimiter: '\n|+', hasContent: true },
            row: { delimiter: '\n|-' },
            header: {
                delimiter: '\n!',
                delimiterMidline: '!!',
                hasContent: true,
            },
            cell: {
                delimiter: '\n|',
                delimiterMidline: '||',
                hasContent: true,
            },
            end: { delimiter: '\n|}' },
        };

        // Prefer to return as record, if the columns have labels, otherwise fallback to a 2d-array
        if (!wikitext.includes(mu.header.delimiter)) {
            // eslint-disable-next-line no-param-reassign
            format = '2d';
        }

        const headers: string[] = [];
        const isRecord = format === 'record' || format === 'both';

        const rows: TableRow[] | string[][] = [];
        let currentRow: TableRow | string[] = isRecord ? {} : [];

        const tableSection =
            /(\n(?:\|\+|\|-|!|\|))([\s\S]*?)(?=\n(?:\|\+|\|-|!|\||\|}))/g;

        const sections = [...wikitext.matchAll(tableSection)].flatMap(
            ([, markup, content]) => {
                const type: WikitableMarkup = (
                    Object.entries(mu) as [WikitableMarkup, MarkupInfo][]
                ).find(([, { delimiter }]) => markup === delimiter)![0];

                if (mu[type].delimiterMidline) {
                    return content
                        .split(mu[type].delimiterMidline!)
                        .map((cellContent) => ({
                            content: mu[type].hasContent
                                ? this.parseWikiTableCell(cellContent)
                                : undefined,
                            type,
                        }));
                }

                return [
                    {
                        type,
                        content: mu[type].hasContent
                            ? this.parseWikiTableCell(content)
                            : undefined,
                    },
                ];
            },
        );

        const pendingHeaders: string[] = [];

        function processCell(content: string) {
            if (Array.isArray(currentRow)) {
                currentRow.push(content);
            } else {
                let currentColumnIndex = Object.keys(currentRow).length;

                if (format === 'both') {
                    currentColumnIndex /= 2;
                }

                const header = headers[currentColumnIndex];
                currentRow[header] = content;

                if (format === 'both') {
                    currentRow[currentColumnIndex] = content;
                }
            }
        }

        sections.forEach(({ type, content }) => {
            if (type === 'row') {
                if (Object.keys(currentRow).length > 0) {
                    rows.push(currentRow as any);
                    currentRow = isRecord ? {} : [];
                } else {
                    headers.push(
                        ...pendingHeaders
                            .splice(0)
                            .map(MediaWikiParser.stripMarkup),
                    );
                }
            }

            if (!content) {
                return;
            }

            if (type === 'header') {
                pendingHeaders.push(content);
            } else if (type === 'cell') {
                if (pendingHeaders.length > 0) {
                    pendingHeaders.splice(0).forEach(processCell);
                }

                processCell(content);
            }
        });

        if (Object.keys(currentRow).length > 0) {
            rows.push(currentRow as any);
        }

        return rows;
    }

    static stripMarkup(value: string): string {
        let v = value.replace(/\[\[File:([^|]*?)(?:\|[^|]+?)*\]\]/g, ''); // remove files
        v = v.replace(/\[\[.*?\|(.*?)\]\]/g, '$1'); // extract link labels
        v = v.replace(/\[\[(.*?)\]\]/g, '$1');
        v = v.replace(/{{Q\|(.*?)(?:\|.*?)?}}/g, '$1');
        v = v.replace(/\{\{([^|}]+?)\}\}/g, '$1');
        v = v.replace(/{{.*?\|(.*?)}}/g, '$1'); // extract template parameters
        v = v.replace(/'''(.*?)'''/g, '$1'); // bold text
        v = v.replace(/''(.*?)''/g, '$1'); // italic text
        v = v.replace(/`/g, ''); // backticks
        v = v.replace(/<.*?>/g, ''); // strip out any html tags
        v = v.replace(/style=".*?" \| /g, ''); // strip out style attributes
        v = v.replace(/(\w+)\.webp|\.png/g, '$1'); // remove image extensions
        v = v.trim(); // remove spaces from start and end

        return v;
    }
}
