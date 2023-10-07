// classes.ts
import express, { Request, Response, Router } from 'express';
import { getCharacterClassData } from '../models/character-class/character-class';

export const router: Router = express.Router();

router.get('/info', async (req: Request, res: Response) => {
    const ccd = await getCharacterClassData();

    const entries = await Promise.all(
        ccd.map(async (cls) => {
            return [cls.name, await cls.getBasicInfo()];
        }),
    );

    res.json(Object.fromEntries(entries));
});

// router.get('/progression/:classes', async (req: Request, res: Response) => {
//     const ccd = await getCharacterClassData();

//     const classNames = req.params.classes.split(',');
//     const classesInfo = classNames.map((className) => classData[className]);

//     // Check if one of the classes wasn't found
//     if (classesInfo.some((info) => !info)) {
//         return res
//             .status(404)
//             .json({ error: 'One or more classes not found.' });
//     }

//     res.json(classesInfo);
// });

export const classesRouter = router;
