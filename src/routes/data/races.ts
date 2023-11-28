// races.ts
import express, { Request, Response, Router } from 'express';
import { getCharacterRaceData } from '../../models/character-feature/features/character-race';

export const router: Router = express.Router();

router.get('/info', async (req: Request, res: Response) => {
    const data = await getCharacterRaceData();

    res.json(data);
});

export const racesRouter = router;
