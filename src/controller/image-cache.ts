import { Request, Response } from 'express';
import assert from 'assert';
import { ImageCacheModel } from '../models/image-cache';
import { error, warn } from '../models/logger';
import { CONFIG } from '../models/config';

const failedRequests: {
    [imagePath: string]: { code: number; message: string };
} = {};

export class ImageClassController {
    static async getImage(req: Request, res: Response): Promise<void> {
        const { imageName } = req.params;
        const { w, p } = req.query as {
            w?: string;
            p?: string;
        };

        const width: number | undefined =
            typeof w === 'string' && !Number.isNaN(Number(w))
                ? Number(w)
                : undefined;

        const preload: boolean = typeof p !== 'undefined';

        if (CONFIG.IS_DEV && !preload && !width) {
            warn(
                `Warning: Serving image '${imageName}' with no specified width.`,
            );
        }

        if (failedRequests[imageName]) {
            const { code, message } = failedRequests[imageName];
            res.status(code).send(message);

            return;
        }

        try {
            const image = await ImageCacheModel.getImage(
                imageName,
                width,
                preload,
            );

            if (image.isUnknownSize) {
                res.setHeader(
                    'Access-Control-Expose-Headers',
                    'X-Unknown-Size',
                );

                res.setHeader('X-Unknown-Size', 'true');
            }

            if ('file' in image) {
                res.sendFile(image.file);
            } else if ('redirect' in image) {
                res.redirect(image.redirect);
            } else {
                throw new Error();
            }
        } catch (err) {
            // FIXME: Not all exceptions are 404!
            failedRequests[imageName] = {
                code: 404,
                message: 'Remote asset not found',
            };

            res.status(404).send('Remote asset not found');
        }
    }

    static async resizePreloadImage(
        req: Request,
        res: Response,
    ): Promise<void> {
        try {
            const { imageName } = req.params;
            const { width } = req.body;

            assert(typeof imageName === 'string');
            assert(typeof width === 'number' && width > 0);

            await ImageCacheModel.resizePreloadImage(imageName, width);

            res.status(200).send();
        } catch (err) {
            error(err);
            res.status(500).send();
        }
    }
}
