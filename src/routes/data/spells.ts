// spells.ts
import express, { Request, Response, Router } from 'express';
import { getSpellDataFiltered } from '../../models/action/spell';

export const router: Router = express.Router();

router.get('/', async (req: Request, res: Response) => {
    const spellData = await getSpellDataFiltered();

    res.json(spellData);
});

export const spellsRouter = router;
