// backgrounds.ts
import express, { Request, Response, Router } from 'express';
import { getCharacterBackgroundData } from '../models/character-feature/features/character-background';

export const router: Router = express.Router();

router.get('/info', async (req: Request, res: Response) => {
    const backgroundsData = await getCharacterBackgroundData();

    const data = backgroundsData.map((background) => background.getInfo());

    res.json(data);
});

export const backgroundsRouter = router;
