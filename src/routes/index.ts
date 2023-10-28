import express, { Router } from 'express';

import { imageRouter } from './images';
import { dataRouter } from './data';

export const router: Router = express.Router();

router.use('/data', dataRouter);
router.use('/images', imageRouter);

export const apiRouter = router;
