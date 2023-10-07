// races.ts
import express, { Request, Response, Router } from 'express';
import { getCharacterRaceData } from '../models/character-race/character-race';

export const router: Router = express.Router();

router.get('/info', async (req: Request, res: Response) => {
    const ccd = await getCharacterRaceData();

    const entries = await Promise.all(
        ccd.map(async (race) => {
            return [race.name, await race.getInfo()];
        }),
    );

    res.json(Object.fromEntries(entries));
});

export const racesRouter = router;
