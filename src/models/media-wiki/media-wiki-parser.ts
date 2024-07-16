import { WikitableNotFoundError } from './types';
import { error } from '../logger';

interface TableCell {
    content: string;
    type: 'header' | 'cell';
}

interface CellSpans {
    rowspan: number;
    colspan: number;
}

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

        'familiar', // Extra Attack (Familiar) [c30779]
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

    protected static parseWikiTableCellSpan(wikitext: string): CellSpans {
        const spans: CellSpans = { rowspan: 1, colspan: 1 };

        const match = wikitext.match(/rowspan\s*=\s*"?(\d+)"?/);

        if (match) {
            spans.rowspan = parseInt(match[1], 10);
        }

        const match2 = wikitext.match(/colspan\s*=\s*"?(\d+)"?/);

        if (match2) {
            spans.colspan = parseInt(match2[1], 10);
        }

        return spans;
    }

    protected static parseWikiTableCellContents(wikitext: string): string {
        const match = wikitext.match(
            /\s*(?:(?:(?:rowspan|colspan|style|scope)\s*=\s*"?.+?"?\s*)+?\|)?\s*([\s\S]*)\s*/,
        );

        if (!match) {
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
        stripHeaders: boolean = true,
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

        const rows: TableCell[][] = [];
        let currentRow: TableCell[] = [];

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
                                ? this.parseWikiTableCellContents(cellContent)
                                : undefined,
                            type,
                            cellSpan: mu[type].hasContent
                                ? this.parseWikiTableCellSpan(cellContent)
                                : undefined,
                        }));
                }

                return [
                    {
                        type,
                        content: mu[type].hasContent
                            ? this.parseWikiTableCellContents(content)
                            : undefined,
                        cellSpan: mu[type].hasContent
                            ? this.parseWikiTableCellSpan(content)
                            : undefined,
                    },
                ];
            },
        );

        const spans: Map<string, TableCell> = new Map();

        function processSpannedCells(): void {
            while (spans.has(`${rows.length}-${currentRow.length}`)) {
                const cell = spans.get(`${rows.length}-${currentRow.length}`)!;

                spans.delete(`${rows.length}-${currentRow.length}`);

                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                processCell(cell);
            }
        }

        function processCell(
            cell: TableCell,
            { rowspan, colspan }: CellSpans = {
                rowspan: 1,
                colspan: 1,
            },
        ): void {
            processSpannedCells();
            currentRow.push(cell);

            for (let x = rows.length; x < rows.length + rowspan; x += 1) {
                for (
                    let y = currentRow.length - 1;
                    y < currentRow.length - 1 + colspan;
                    y += 1
                ) {
                    if (x === rows.length && y === currentRow.length - 1) {
                        continue;
                    }

                    spans.set(`${x}-${y}`, cell);
                }
            }
        }

        // Process the table into TableCell[][] that accounts for rowspan, colspan
        // This is functionally similar to a 2d array of strings, but we're also keeping track of which cells are header cells

        sections.forEach(({ type, content, cellSpan }) => {
            if (type === 'row') {
                processSpannedCells();

                if (currentRow.length > 0) {
                    rows.push(currentRow);
                    currentRow = [];
                }
            }

            if (typeof content === 'undefined') {
                return;
            }

            if (type === 'cell' || type === 'header') {
                processCell({ content, type }, cellSpan);
            }
        });

        processSpannedCells();

        if (Object.keys(currentRow).length > 0) {
            rows.push(currentRow as any);
        }

        const twoDimensionalRows = rows;

        if (
            !twoDimensionalRows.every(
                (row) =>
                    row.length === twoDimensionalRows[0].length ||
                    row.every(({ type }) => type === 'header'),
            )
        ) {
            error('Expected table to be rectangular!');
        }

        const recordRows = twoDimensionalRows.filter(
            (row) => !row.every(({ type }) => type === 'header'),
        );

        if (format === '2d') {
            return recordRows.map((row) => row.map(({ content }) => content));
        }

        const columnHeaders = twoDimensionalRows.filter((row) =>
            row.every(({ type }) => type === 'header'),
        );

        // Use the content from the final column header row as the keys for the record
        const keys = columnHeaders[columnHeaders.length - 1].map(
            ({ content }) =>
                stripHeaders ? MediaWikiParser.stripMarkup(content) : content,
        );

        return recordRows.map((row) =>
            row.reduce(
                (acc, { content }, index) => {
                    const withKvp = {
                        ...acc,
                        [keys[index]]: content,
                    };

                    if (format === 'both') {
                        return {
                            ...withKvp,
                            [index]: content,
                        };
                    }

                    return withKvp;
                },
                {} as Record<string, string>,
            ),
        );
    }

    protected static matchBalanced(
        text: string,
        prefix: string,
        inner: string,
        suffix: string,
    ): string[] {
        const matches = [
            ...text.matchAll(new RegExp(`${prefix}${inner}`, 'gi')),
        ];

        const matchText = matches
            .map(({ index: startIndex }) => {
                let depth = 0;
                let endIndex;
                const prefixChars = prefix.split('');
                const suffixChars = suffix.split('');

                for (let i = startIndex!; i < text.length; i += 1) {
                    if (
                        prefixChars.every(
                            (char, index) => text[i + index] === char,
                        )
                    ) {
                        depth += 1;
                        i += prefix.length - 1;
                    } else if (
                        suffixChars.every(
                            (char, index) => text[i + index] === char,
                        )
                    ) {
                        depth -= 1;
                        i += suffix.length - 1;
                    }

                    if (depth === 0) {
                        endIndex = i + (suffix.length - 1);
                        break;
                    }
                }

                return endIndex ? text.substring(startIndex!, endIndex) : null;
            })
            .filter(Boolean) as string[];

        return matchText;
    }

    protected static replaceBalanced(
        text: string,
        prefix: string,
        inner: string,
        suffix: string,
        replaceStr: string,
    ): string {
        const matchStrs = this.matchBalanced(text, prefix, inner, suffix);
        let result = text;

        matchStrs.forEach((str) => {
            result = result.replace(str, replaceStr);
        });

        return result;
    }

    static stripMarkup(value: string): string {
        let v = value.replace(/\[\[File:([^|]*?)(?:\|[^|]+?)*\]\]/g, ''); // remove files

        // Templates: Remove
        v = MediaWikiParser.replaceBalanced(v, '{{', 'NoExcerpt', '}}', '');
        v = v.replace(/{{(?:Icon|note)\|.*?}}/gi, '');

        // Templates: Template Name
        v = v.replace(
            /{{(Attack Roll|Advantage|Disadvantage)(?:\|[^|}]+)*}}/gi,
            '$1',
        );

        v = v.replace(/{{(Saving ?Throw|Initiative|action)}}/gi, '$1');

        // Templates: First Arg
        v = v.replace(/{{SAI\|([^|}]*?)(?:\|[^=|}]+=[^|}]+)*}}/gi, '$1');
        v = v.replace(/{{Pass\|([^|}]*?)(?:\|[^=|}]+=[^|}]+)*}}/gi, '$1');
        v = v.replace(/{{Q\|([^|}]*?)(?:\|[^|}]+)*}}/gi, '"$1"');

        v = v.replace(
            /{{Saving ?Throw\|([^|}]*?)(?:\|[^|}]+)*}}/gi,
            '$1 saving throw',
        );

        v = v.replace(
            /{{(?:Class|Initiative|action)\|([^|}]*?)(?:\|[^|}]+)*}}/gi,
            '$1',
        ); // general

        v = v.replace(/{{(?:Cond|Condition)\|([^|}]*?)}}/gi, '$1');

        // Templates: Second Arg
        v = v.replace(
            /{{(?:SAI|Cond|Condition)\|[^|}]+?\|([^|}]*?)(?:\|[^|}]+)*}}/gi,
            '$1',
        );

        // Templates: Third Arg
        v = v.replace(
            /{{(?:SmIconLink)\|[^|}]+?\|[^|}]+?\|([^|}]+?)(?:\|[^|}]+)*}}/gi,
            '$1',
        ); // replace with template third arg

        // debug match for finding unparsed templates
        // const m = v.match(/(?<=[^{]|^){{([^|{}]+?)(?:\|[^{}]*?)*}}(?=[^}]|$)/i);

        // Links
        v = v.replace(/\[\[[^|\]]*?\|([^|\]]*?)\]\]/g, '$1'); // with label
        v = v.replace(/\[\[([^\]]*?)\]\]/g, '$1'); // without label

        // Template catch-all (FIXME)
        // templates that probably should not be scrubbed: DamageColor, DamageText, DamageInfo, Distance
        v = v.replace(/{{.*?\|(.*?)}}/g, '$1'); // extract template parameters
        v = v.replace(/{{([^|}]+?)}}/g, '$1');

        v = v.replace(/'''(.*?)'''/g, '$1'); // bold text
        v = v.replace(/''(.*?)''/g, '$1'); // italic text
        v = v.replace(/`/g, ''); // backticks
        v = v.replace(/<.*?>/g, ''); // strip out any html tags
        v = v.replace(/style=".*?"\s?\|\s?/g, ''); // strip out style attributes
        v = v.replace(/scope=".*?"\s?\|\s?/g, ''); // strip out scope attribute
        v = v.replace(/(\w+)\.webp|\.png/g, '$1'); // remove image extensions
        v = v.trim(); // remove spaces from start and end

        return v;
    }
}
