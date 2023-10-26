// actions.ts
import express, { Request, Response, Router } from 'express';
import { getActionData, getActionDataById } from '../models/action/action';

export const router: Router = express.Router();

router.get('/info/id', async (req: Request, res: Response) => {
    const ids = (req.query.ids as string)
        .split(',')
        .map((val) => parseInt(val, 10));

    const actionData = await getActionDataById();

    res.json(ids.map((id) => actionData.get(id)));
});

router.get('/info', async (req: Request, res: Response) => {
    const actionData = await getActionData();

    res.json(actionData);
});

export const actionsRouter = router;
