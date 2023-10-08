// backgrounds.ts
import express, { Request, Response, Router } from 'express';
import { getCharacterBackgroundData } from '../models/character-feature/character-background/character-background';

export const router: Router = express.Router();

router.get('/info', async (req: Request, res: Response) => {
    const backgroundsData = await getCharacterBackgroundData();

    const entries = await Promise.all(
        backgroundsData.map(async (background) => {
            return [background.name, await background.getInfo()];
        }),
    );

    res.json(Object.fromEntries(entries));
});

export const backgroundsRouter = router;
