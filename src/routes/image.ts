import express, { Request, Response, Router } from 'express';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { error, log } from '../models/logger';
import { MediaWiki } from '../models/media-wiki';

const rootDir = path.dirname(require.main!.filename);
const IMAGE_CACHE_DIR = path.join(rootDir, 'cache');
const failedRequests: {
    [imagePath: string]: { code: number; message: string };
} = {};

const ensureDirectoryExistence = async (filePath: string) => {
    const dirName = path.dirname(filePath);

    if (fs.existsSync(dirName)) {
        return;
    }

    await ensureDirectoryExistence(dirName);
    await fs.promises.mkdir(dirName);
};

export const router: Router = express.Router();

router.get('/:imageName', async (req: Request, res: Response) => {
    const { imageName } = req.params;
    const localImagePath = path.join(
        IMAGE_CACHE_DIR,
        MediaWiki.getImagePath(imageName),
    );

    if (failedRequests[imageName]) {
        res.status(failedRequests[imageName].code).send(
            failedRequests[imageName].message,
        );

        return;
    }

    try {
        await fs.promises.access(localImagePath);
        res.sendFile(localImagePath);

        return;
    } catch (err) {
        // File does not exist, we'll fetch from remote next.
    }

    try {
        const remoteUrl = await MediaWiki.resolveImageRedirect(imageName);

        https
            .get(remoteUrl, async (response) => {
                if (
                    response.statusCode &&
                    (response.statusCode < 200 || response.statusCode >= 300)
                ) {
                    if (
                        response.statusCode >= 400 &&
                        response.statusCode < 500
                    ) {
                        failedRequests[imageName] = {
                            code: response.statusCode,
                            message:
                                response.statusMessage ?? 'Unspecified error',
                        };
                    }

                    res.status(response.statusCode).send(
                        response.statusMessage ?? 'Error fetching the image',
                    );

                    return;
                }

                // Ensure all subdirectories exist before writing
                await ensureDirectoryExistence(localImagePath);

                const writer = fs.createWriteStream(localImagePath);
                response.pipe(writer);

                writer.on('finish', () => {
                    log(`Cached ${localImagePath}.`);
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
    } catch (err) {
        res.status(404).send('Remote asset not found');
    }
});

export const imageRouter = router;
