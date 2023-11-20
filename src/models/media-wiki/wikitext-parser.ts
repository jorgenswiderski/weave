type TableRow = Record<string, string>;

export class MediaWikiParser {
    static getAllPageTitles(wikitext: string): string[] {
        const pageTitleMatch = /\[\[([^#|\]]+).*?]]/g;
        const coordsTemplateMatch = /{{Coords\|-?\d+\|-?\d+\|([^}]+)}}/g;

        return [
            ...wikitext.matchAll(pageTitleMatch),
            ...wikitext.matchAll(coordsTemplateMatch),
        ].map((match) => match[1]);
    }

    static parseNameFromPageTitle(title: string) {
        return title.split('(')[0].trim();
    }

    static removeComments(wikitext: string): string {
        return wikitext.replace(/<!--[\s\S]*?-->/g, '');
    }

    protected static parseWikiTableCell(wikitext: string): string {
        const match = wikitext.match(/[|!]\s*(?:style=".+?"\s*\|)?\s*(.+)/);

        if (!match?.[1]) {
            throw new Error();
        }

        return match[1].trim();
    }

    static parseWikiTable(wikitext: string, format: '2d'): string[][];
    static parseWikiTable(
        wikitext: string,
        format: 'record',
    ): Record<string, string>[];
    static parseWikiTable(
        wikitext: string,
        format: 'record' | '2d' = 'record',
    ): Record<string, string>[] | string[][] {
        const lines = wikitext.split('\n');

        // Prefer to return as record, if the columns have labels, otherwise fallback to a 2d-array
        if (!lines.some((line) => line.startsWith('!'))) {
            // eslint-disable-next-line no-param-reassign
            format = '2d';
        }

        let headers: string[];

        if (format === 'record') {
            headers = lines
                .filter((line) => line.startsWith('!'))
                .map(this.parseWikiTableCell)
                .map(MediaWikiParser.stripMarkup);
        }

        const rows: TableRow[] | string[][] = [];
        let currentRow: TableRow | string[] = format === 'record' ? {} : [];

        lines.forEach((line) => {
            if (line.startsWith('|}') || line.startsWith('|+')) {
                return;
            }

            if (line.startsWith('|-')) {
                if (Object.keys(currentRow).length > 0) {
                    rows.push(currentRow as any);
                    currentRow = format === 'record' ? {} : [];
                }
            } else if (line.startsWith('|')) {
                const content = this.parseWikiTableCell(line);

                if (Array.isArray(currentRow)) {
                    currentRow.push(content);
                } else {
                    const currentColumnIndex = Object.keys(currentRow).length;
                    const header = headers[currentColumnIndex];
                    currentRow[header] = content;
                }
            }
        });

        // Add the last row if it exists
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
