// races.ts
import express, { Request, Response, Router } from 'express';
import { getCharacterRaceData } from '../models/character-feature/features/character-race';

export const router: Router = express.Router();

router.get('/info', async (req: Request, res: Response) => {
    const ccd = await getCharacterRaceData();

    const data = await Promise.all(ccd.map(async (race) => race.getInfo()));

    res.json(data);
});

export const racesRouter = router;
