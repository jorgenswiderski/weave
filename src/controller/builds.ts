import { Request, Response } from 'express';
import { BuildId } from '@jorgenswiderski/tomekeeper-shared/dist/types/builds';
import { Builds } from '../models/builds/builds';
import {
    BuildDataTooLargeError,
    BuildNotFoundError,
} from '../models/builds/types';
import { Utils } from '../models/utils';

export class BuildsController {
    static async create(req: Request, res: Response): Promise<void> {
        try {
            const { encodedData, buildVersion } = req.body;
            const ip = Utils.getClientIp(req);

            if (
                typeof encodedData !== 'string' ||
                typeof buildVersion !== 'string'
            ) {
                res.status(400).json({ error: 'Invalid input' });

                return;
            }

            const buildId = await Builds.create(encodedData, buildVersion, ip);
            res.status(201).json({ buildId });
        } catch (err) {
            if (err instanceof BuildDataTooLargeError) {
                res.status(413).json({ error: err.message });

                return;
            }

            throw err;
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        const { id } = req.params as { id: BuildId };
        const ip = Utils.getClientIp(req);

        if (typeof id !== 'string') {
            res.status(400).json({ error: 'Invalid input' });

            return;
        }

        await Builds.delete(id, ip);
        res.status(204).send();
    }

    static async update(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params as { id: BuildId };
            const ip = Utils.getClientIp(req);

            if (typeof id !== 'string') {
                res.status(400).json({ error: 'Invalid input' });

                return;
            }

            const { encodedData, buildVersion } = req.body;

            if (
                typeof encodedData !== 'string' ||
                typeof buildVersion !== 'string'
            ) {
                res.status(400).json({ error: 'Invalid input' });

                return;
            }

            await Builds.update(id, encodedData, buildVersion, ip);
            res.status(204).send();
        } catch (err) {
            if (err instanceof BuildDataTooLargeError) {
                res.status(413).json({ error: err.message });

                return;
            }

            if (err instanceof BuildNotFoundError) {
                res.status(404).json({ error: err.message });

                return;
            }

            throw err;
        }
    }

    static async get(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params as { id: BuildId };
            const ip = Utils.getClientIp(req);

            if (typeof id !== 'string' || !Utils.isUuid(id)) {
                res.status(400).json({ error: 'Invalid input' });

                return;
            }

            const build = await Builds.get(id, ip);
            res.json(build);
        } catch (err) {
            if (err instanceof BuildNotFoundError) {
                res.status(404).json({ error: err.message });

                return;
            }

            throw err;
        }
    }
}
