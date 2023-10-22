// items.ts
import express, { Request, Response, Router } from 'express';
import {
    getEquipmentItemData,
    getEquipmentItemInfoById,
} from '../models/equipment/equipment-item';

export const router: Router = express.Router();

router.get('/equipment/type', async (req: Request, res: Response) => {
    const typesParam = req.query.types as string | undefined;
    let types: number[] | undefined;

    if (typesParam) {
        types = typesParam.split(',').map((value) => parseInt(value, 10));
    }

    const itemData = await getEquipmentItemData(types);

    res.json(itemData);
});

router.get('/equipment/id', async (req: Request, res: Response) => {
    const ids = (req.query.ids as string)
        .split(',')
        .map((val) => parseInt(val, 10));

    const itemData = await getEquipmentItemInfoById();

    res.json(ids.map((id) => itemData.get(id)));
});

export const itemsRouter = router;
