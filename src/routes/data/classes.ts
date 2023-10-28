// classes.ts
import express, { Request, Response, Router } from 'express';
import { getCharacterClassData } from '../../models/character-class/character-class';

export const router: Router = express.Router();

router.get('/', async (req: Request, res: Response) => {
    const ccd = await getCharacterClassData();

    const data = await Promise.all(ccd.map(async (cls) => cls.getInfo()));

    res.json(data);
});

export const classesRouter = router;
