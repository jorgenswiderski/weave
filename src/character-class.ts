import { ApiPage } from 'mwn';
import { mwnApi } from './api/mwn';
import { MediaWiki, PageData } from './media-wiki';
import { ClassFeature, parseClassFeature } from './class-features';

export async function getCharacterClassData(): Promise<void> {
    const classes = await mwnApi.fetchTitlesFromCategory('Classes');

    const pages = await Promise.all(classes.map((c) => MediaWiki.getPage(c)));

    if (pages[0]) {
        processClassProgression(pages[0]);
    }
}

function processClassProgression(page: PageData) {
    if (!page.content) {
        return;
    }

    // Step 1: Isolate the class progression table
    const tableRegex = /\{\|([\s\S]*?)\|\}/g; // Capture everything between {| and |}
    const rowRegex = /\|-\s*([\s\S]*?)(?=\|-\s*|$)/g; // Capture rows between |- and the next |- or end of string
    const cellRegex = /\|([^\n]*)/g; // Capture content of each cell

    const match = tableRegex.exec(page.content);
    if (match) {
        const tableContent = match[1];
        const rows = [...tableContent.matchAll(rowRegex)];
        const parsedRows = rows.map((row) => {
            const cells = [...row[1].matchAll(cellRegex)];
            return cells.map((cell) => cell[1].trim());
        });
        console.log(parsedRows);

        const titleRow = parsedRows[0]; // We're not using this but just for clarity
        const keys = parsedRows[1];
        const dataRows = parsedRows.slice(2);

        const formattedData = dataRows.map((row) => {
            return row.reduce(
                (obj, cell, index) => {
                    obj[keys[index]] = cell;
                    return obj;
                },
                {} as { [key: string]: any },
            );
        });

        console.log(formattedData);

        function stripWikiMarkup(value: string): string {
            value = value.replace(/\[\[.*?\|(.*?)\]\]/g, '$1'); // extract link labels
            value = value.replace(/\[\[(.*?)\]\]/g, '$1');
            value = value.replace(/{{.*?\|(.*?)}}/g, '$1'); // extract template parameters
            value = value.replace(/'''(.*?)'''/g, '$1'); // bold text
            value = value.replace(/''(.*?)''/g, '$1'); // italic text
            value = value.replace(/`/g, ''); // backticks
            value = value.replace(/<.*?>/g, ''); // strip out any html tags
            value = value.replace(/style=".*?" \| /g, ''); // strip out style attributes
            value = value.replace(/(\w+)\.webp|\.png/g, '$1'); // remove image extensions
            value = value.trim(); // remove spaces from start and end

            return value;
        }

        function parseFeatures(value: string): ClassFeature[] {
            const features = value.split(', ').map(parseClassFeature);

            return features;
        }

        const cleanedData = formattedData.map((item) => {
            const cleanedItem: {
                [key: string]: string | number | string[] | ClassFeature[];
            } = {};

            for (const key in item) {
                const cleanedKey = stripWikiMarkup(key);

                if (cleanedKey === 'Features') {
                    cleanedItem[cleanedKey] = parseFeatures(item[key]);
                } else {
                    const value = stripWikiMarkup(item[key]);

                    // Try to convert to integer
                    const intValue = parseInt(value, 10);
                    if (!isNaN(intValue)) {
                        cleanedItem[cleanedKey] = intValue;
                    } else {
                        cleanedItem[cleanedKey] = value;
                    }
                }
            }

            return cleanedItem;
        });

        console.log(cleanedData);
    } else {
        console.log('No table found');
    }
}
