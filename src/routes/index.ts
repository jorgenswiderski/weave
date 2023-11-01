import express, { Router } from 'express';

import { imageRouter } from './images';
import { dataRouter } from './data';
import { buildsRouter } from './builds';

export const router: Router = express.Router();

router.use('/data', dataRouter);
router.use('/images', imageRouter);
router.use('/builds', buildsRouter);

export const apiRouter = router;
