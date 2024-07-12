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

    protected static parseWikiTableCellSpan(
        wikitext: string,
    ): number | undefined {
        const match = wikitext.match(
            /\s*(rowspan=".+?"\s*)?(colspan=".+?"\s*)?(?:style=".+?"\s*)?\|?\s*([\s\S]*)\s*/,
        );

        if (!match) {
            throw new Error();
        }

        if (match[1]) {
            return parseInt(match[1].match(/rowspan="(\d+)"/)![1], 10);
        }

        return undefined;
    }

    protected static parseWikiTableCellContents(wikitext: string): string {
        const match = wikitext.match(
            /\s*((?:rowspan|colspan)=".+?"\s*\|)?(?:style=".+?"\s*\|)?\s*([\s\S]*)\s*/,
        );

        if (!match) {
            throw new Error();
        }

        return match[2].trim();
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

        let headers: string[] = [];
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
                                ? this.parseWikiTableCellContents(cellContent)
                                : undefined,
                            type,
                            rows: mu[type].hasContent
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
                        rows: mu[type].hasContent
                            ? this.parseWikiTableCellSpan(content)
                            : undefined,
                    },
                ];
            },
        );

        const pendingHeaders: string[] = [];
        const rowSpans: Map<string, string> = new Map();

        function processSpannedCells(): void {
            while (
                rowSpans.has(`${rows.length}-${Object.keys(currentRow).length}`)
            ) {
                const spanContent = rowSpans.get(
                    `${rows.length}-${Object.keys(currentRow).length}`,
                )!;

                rowSpans.delete(
                    `${rows.length}-${Object.keys(currentRow).length}`,
                );

                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                processCell(spanContent);
            }
        }

        function processCell(content: string, rowSpan?: number) {
            processSpannedCells();

            let currentColumnIndex = Object.keys(currentRow).length;

            if (format === 'both') {
                currentColumnIndex /= 2;
            }

            if (Array.isArray(currentRow)) {
                currentRow.push(content);
            } else {
                const header = headers[currentColumnIndex];
                currentRow[header] = content;

                if (format === 'both') {
                    currentRow[currentColumnIndex] = content;
                }

                if (rowSpan && rowSpan > 1) {
                    for (
                        let x = rows.length + 1;
                        x < rows.length + rowSpan;
                        x += 1
                    ) {
                        rowSpans.set(`${x}-${currentColumnIndex}`, content);
                    }
                }
            }
        }

        sections.forEach(({ type, content, rows: rowSpan }) => {
            if (type === 'row') {
                processSpannedCells();

                if (Object.keys(currentRow).length > 0) {
                    rows.push(currentRow as any);
                    currentRow = isRecord ? {} : [];
                } else {
                    headers = pendingHeaders
                        .splice(0)
                        .map(MediaWikiParser.stripMarkup);
                }
            }

            if (typeof content === 'undefined') {
                return;
            }

            // If this is a row header, force it to be a cell instead
            if (type === 'header' && content.includes('#Level ')) {
                // eslint-disable-next-line no-param-reassign
                type = 'cell';
            }

            if (type === 'header') {
                pendingHeaders.push(content);
            } else if (type === 'cell') {
                processCell(content, rowSpan);
            }
        });

        processSpannedCells();

        if (Object.keys(currentRow).length > 0) {
            rows.push(currentRow as any);
        }

        return rows;
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
        v = v.replace(/style=".*?" \| /g, ''); // strip out style attributes
        v = v.replace(/(\w+)\.webp|\.png/g, '$1'); // remove image extensions
        v = v.trim(); // remove spaces from start and end

        return v;
    }
}
