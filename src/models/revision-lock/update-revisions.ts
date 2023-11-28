/* eslint-disable no-console */
/* eslint-disable import/first */
import dotenv from 'dotenv';

dotenv.config();

import readline from 'readline';
import { MongoCollections, getMongoDb } from '../mongo';
import { MediaWiki } from '../media-wiki/media-wiki';
import { CONFIG } from '../config';

// Override this config value to allow the DB to be revised
CONFIG.MEDIAWIKI.USE_LOCKED_REVISIONS = false;
CONFIG.MEDIAWIKI.REVISION_CHECK_THROTTLE_IN_MILLIS = 0;

// Get regex pattern from command line arguments
const patternArg = process.argv[2];

if (!patternArg) {
    console.error('No regex pattern provided');
    process.exit(1);
}

const pattern = new RegExp(patternArg);

function promptQuestion(query: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
}

async function updateRevisions() {
    try {
        const db = await getMongoDb();
        const collection = db.collection(MongoCollections.MW_PAGES);

        // Fetch all pages with titles matching the regex
        const documents = await collection
            .find({ title: { $regex: pattern } })
            .toArray();

        if (documents.length === 0) {
            console.warn('Could not find any documents matching that pattern.');
            process.exit(1);
        }

        const pageTitles = documents.map(({ title }) => title);

        // Print a list of the page titles
        console.log(
            `Found ${pageTitles.length} pages matching the pattern${
                pageTitles.length <= 20 ? ':' : '.'
            }`,
        );

        if (pageTitles.length <= 20) {
            pageTitles.forEach((title) => console.log(`  ${title}`));
        }

        // Ask the user if they want to continue
        const userConsent = await promptQuestion(
            'Do you want to continue? (y/n) ',
        );

        if (!userConsent) {
            console.log('Operation cancelled by the user.');
            process.exit(0);
        }

        const startTime = Date.now();
        let updatedCounter = 0;

        await Promise.all(
            documents.map(async ({ title, revisionId }) => {
                const page = await MediaWiki.getPage(title);

                if (page.revisionId !== revisionId) {
                    updatedCounter += 1;
                }
            }),
        );

        console.log(
            `Updated ${updatedCounter} of ${pageTitles.length} pages in ${
                (Date.now() - startTime) / 1000
            }s. ${
                pageTitles.length - updatedCounter
            } pages were already up to date.`,
        );

        console.log('Run dump-data to update revision-lock.json.');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

updateRevisions();
