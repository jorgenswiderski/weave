// spells.ts
import express, { Request, Response, Router } from 'express';
import { getSpellData } from '../models/spell/spell';

export const router: Router = express.Router();

router.get('/info', async (req: Request, res: Response) => {
    const spellData = await getSpellData();

    const filterEmptyClasses = req.query.filter === 'class';
    const filteredSpellData = filterEmptyClasses
        ? spellData.filter((spell) => spell.classes && spell.classes.length > 0)
        : spellData;

    res.json(filteredSpellData);
});

export const spellsRouter = router;
