// items.ts
import express, { Request, Response, Router } from 'express';
import { getEquipmentItemData } from '../models/equipment/equipment-item';

export const router: Router = express.Router();

router.get('/equipment', async (req: Request, res: Response) => {
    const typesParam = req.query.types as string | undefined;
    let types: number[] | undefined;

    if (typesParam) {
        types = typesParam.split(',').map((value) => parseInt(value, 10));
    }

    const itemData = await getEquipmentItemData(types);

    res.json(itemData);
});

export const itemsRouter = router;
