// classes.ts
import express, { Request, Response, Router } from 'express';
import { getCharacterClassData } from '../../models/character-class/character-class';

export const router: Router = express.Router();

router.get('/', async (req: Request, res: Response) => {
    const data = await getCharacterClassData();

    res.json(data);
});

export const classesRouter = router;
