// passives.ts
import express, { Request, Response, Router } from 'express';
import { getPassiveDataFiltered } from '../../models/characteristic/characteristic';

export const router: Router = express.Router();

router.get('/', async (req: Request, res: Response) => {
    const passiveData = getPassiveDataFiltered();

    res.json(passiveData);
});

export const passivesRouter = router;
