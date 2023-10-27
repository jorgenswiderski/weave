// actions.ts
import express, { Request, Response, Router } from 'express';
import { getActionData } from '../models/action/action';

export const router: Router = express.Router();

router.get('/', async (req: Request, res: Response) => {
    const actionData = await getActionData();

    res.json(actionData);
});

export const actionsRouter = router;
