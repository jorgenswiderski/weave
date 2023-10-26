// spells.ts
import express, { Request, Response, Router } from 'express';
import { getSpellData, getSpellDataById } from '../models/action/spell';

export const router: Router = express.Router();

router.get('/info/id', async (req: Request, res: Response) => {
    const ids = (req.query.ids as string)
        .split(',')
        .map((val) => parseInt(val, 10));

    const spellData = await getSpellDataById();

    res.json(ids.map((id) => spellData.get(id)));
});

router.get('/info', async (req: Request, res: Response) => {
    const spellData = await getSpellData();

    const filterEmptyClasses = req.query.filter === 'class';
    const filteredSpellData = filterEmptyClasses
        ? spellData.filter((spell) => spell.classes && spell.classes.length > 0)
        : spellData;

    res.json(filteredSpellData);
});

export const spellsRouter = router;
