// actions.ts
import express, { Request, Response, Router } from 'express';
import { getActionDataFiltered } from '../../models/action/init';

export const router: Router = express.Router();

router.get('/', async (req: Request, res: Response) => {
    const actionData = await getActionDataFiltered();

    res.json(actionData);
});

export const actionsRouter = router;
