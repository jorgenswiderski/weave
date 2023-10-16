import express, { Request, Response, Router } from 'express';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { CONFIG } from '../models/config';
import { error } from '../models/logger';

const rootDir = path.dirname(require.main!.filename);
const IMAGE_CACHE_DIR = path.join(rootDir, 'cache');
const failedRequests: { [imagePath: string]: number } = {};

const ensureDirectoryExistence = async (filePath: string) => {
    const dirName = path.dirname(filePath);

    if (fs.existsSync(dirName)) {
        return;
    }

    await ensureDirectoryExistence(dirName);
    await fs.promises.mkdir(dirName);
};

export const router: Router = express.Router();

router.get('/:imagePath(*)', async (req: Request, res: Response) => {
    const { imagePath } = req.params;
    const localImagePath = path.join(IMAGE_CACHE_DIR, imagePath);

    if (failedRequests[imagePath]) {
        res.status(failedRequests[imagePath]).send('Known failed request');

        return;
    }

    try {
        await fs.promises.access(localImagePath);
        res.sendFile(localImagePath);

        return;
    } catch (err) {
        // File does not exist, we'll fetch from remote next.
    }

    const remotePath = `${CONFIG.MEDIAWIKI.BASE_URL}/images/${imagePath}`;

    https
        .get(remotePath, async (response) => {
            if (
                response.statusCode &&
                (response.statusCode < 200 || response.statusCode >= 300)
            ) {
                if (response.statusCode >= 400 && response.statusCode < 500) {
                    failedRequests[imagePath] = response.statusCode;
                }

                res.status(response.statusCode).send(
                    'Error fetching the image',
                );

                return;
            }

            // Ensure all subdirectories exist before writing
            await ensureDirectoryExistence(localImagePath);

            const writer = fs.createWriteStream(localImagePath);
            response.pipe(writer);

            writer.on('finish', () => {
                res.sendFile(localImagePath);
            });

            writer.on('error', (writeError) => {
                error(writeError);
                res.status(500).send('Error saving the image');
            });
        })
        .on('error', (err) => {
            // Handle other types of errors (e.g. network issues)
            error(err);
            res.status(500).send('Failed to retrieve the image');
        });
});

export const imageRouter = router;
