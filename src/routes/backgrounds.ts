// backgrounds.ts
import express, { Request, Response, Router } from 'express';
import { getCharacterBackgroundData } from '../models/character-feature/features/character-background';

export const router: Router = express.Router();

router.get('/id', async (req: Request, res: Response) => {
    const ids = (req.query.ids as string)
        .split(',')
        .map((val) => parseInt(val, 10));

    const backgroundsData = await getCharacterBackgroundData();

    const data = backgroundsData.map((background) => background.getInfo());
    const filtered = data.filter((datum) => ids.includes(datum.id));

    res.json(Object.fromEntries(filtered.map((datum) => [datum.id, datum])));
});

router.get('/', async (req: Request, res: Response) => {
    const backgroundsData = await getCharacterBackgroundData();

    const data = backgroundsData.map((background) => background.getInfo());

    res.json(data);
});

export const backgroundsRouter = router;
