// backgrounds.ts
import express, { Request, Response, Router } from 'express';
import { getCharacterBackgroundData } from '../../models/character-feature/features/character-background';

export const router: Router = express.Router();

router.get('/id', async (req: Request, res: Response) => {
    const ids = (req.query.ids as string)
        .split(',')
        .map((val) => parseInt(val, 10));

    const data = await getCharacterBackgroundData();
    const filtered = data.filter((datum) => datum.id && ids.includes(datum.id));

    res.json(Object.fromEntries(filtered.map((datum) => [datum.id, datum])));
});

router.get('/', async (req: Request, res: Response) => {
    const data = await getCharacterBackgroundData();

    res.json(data);
});

export const backgroundsRouter = router;
