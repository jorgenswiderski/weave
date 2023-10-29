import express, { Request, Response } from 'express';
import { BuildId } from 'planner-types/src/types/builds';
import { Builds } from '../models/builds/builds';
import {
    BuildDataTooLargeError,
    BuildNotFoundError,
} from '../models/builds/types';
import { error } from '../models/logger';
import { Utils } from '../models/utils';

const router = express.Router();

// Parse JSON body
router.use(express.json());

router.post('/create', async (req: Request, res: Response) => {
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

        error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.delete('/delete/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: BuildId };
        const ip = Utils.getClientIp(req);

        if (typeof id !== 'string') {
            res.status(400).json({ error: 'Invalid input' });

            return;
        }

        await Builds.delete(id, ip);
        res.status(204).send();
    } catch (err) {
        error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.put('/update/:id', async (req: Request, res: Response) => {
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

        error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/get/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: BuildId };

        if (typeof id !== 'string' || !Utils.isUuid(id)) {
            res.status(400).json({ error: 'Invalid input' });

            return;
        }

        const build = await Builds.get(id);
        res.json(build);
    } catch (err) {
        if (err instanceof BuildNotFoundError) {
            res.status(404).json({ error: err.message });

            return;
        }

        error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export const buildsRouter = router;
