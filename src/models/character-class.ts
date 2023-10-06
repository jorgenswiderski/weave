import { MwnApi } from '../api/mwn';
import { ClassFeature } from './class-features';
import { error, log } from './logger';
import { PageItem } from './page-item';

function stripWikiMarkup(value: string): string {
    let v = value.replace(/\[\[.*?\|(.*?)\]\]/g, '$1'); // extract link labels
    v = v.replace(/\[\[(.*?)\]\]/g, '$1');
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

function parseFeatures(value: string): ClassFeature[] {
    if (value === '-') {
        // No features this level
        return [];
    }

    const features = value.split(', ').map(ClassFeature.fromMarkdownString);

    log(
        value.split(', ').map((str) => ({
            input: str,
            incorrectOutput: ClassFeature.fromMarkdownString(str)?.pageTitle,
        })),
    );

    return features;
}
export class CharacterClass extends PageItem {
    progression?: Record<string, string | number | ClassFeature[]>[];

    constructor(public name: string) {
        super(name);

        this.initProgression().catch(error);
    }

    async initProgression() {
        await this.pageHasLoaded;

        if (!this.page || !this.page.content) {
            return;
        }

        // Step 1: Isolate the class progression table
        const tableRegex = /\{\|([\s\S]*?)\|\}/g; // Capture everything between {| and |}
        const rowRegex = /\|-\s*([\s\S]*?)(?=\|-\s*|$)/g; // Capture rows between |- and the next |- or end of string
        const cellRegex = /\|([^\n]*)/g; // Capture content of each cell

        const match = tableRegex.exec(this.page.content);

        if (match) {
            const tableContent = match[1];
            const rows = [...tableContent.matchAll(rowRegex)];
            const parsedRows = rows.map((row) => {
                const cells = [...row[1].matchAll(cellRegex)];
                return cells.map((cell) => cell[1].trim());
            });
            // log(parsedRows);

            const keys = parsedRows[1];
            const dataRows = parsedRows.slice(2);

            const formattedData = dataRows.map((row) => {
                return row.reduce(
                    (obj, cell, index) => {
                        // eslint-disable-next-line no-param-reassign
                        obj[keys[index]] = cell;
                        return obj;
                    },
                    {} as { [key: string]: any },
                );
            });

            // log(formattedData);

            const cleanedData = formattedData.map((item) => {
                const cleanedItem: {
                    [key: string]: string | number | ClassFeature[];
                } = {};

                Object.keys(item).forEach((key) => {
                    const cleanedKey = stripWikiMarkup(key);

                    if (cleanedKey === 'Features') {
                        cleanedItem[cleanedKey] = parseFeatures(item[key]);
                    } else {
                        const value = stripWikiMarkup(item[key]);

                        // Try to convert to integer
                        const intValue = parseInt(value, 10);
                        if (!Number.isNaN(intValue)) {
                            cleanedItem[cleanedKey] = intValue;
                        } else {
                            cleanedItem[cleanedKey] = value;
                        }
                    }
                });

                return cleanedItem;
            });

            // log(cleanedData);

            this.progression = cleanedData;
        } else {
            throw new Error(
                `No class progression table found for "${this.name}"`,
            );
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let classData: CharacterClass[] = [];

export async function getCharacterClassData(): Promise<void> {
    const classNames = await MwnApi.fetchTitlesFromCategory('Classes');

    classData = await Promise.all(
        classNames.map((name) => new CharacterClass(name)),
    );
}
