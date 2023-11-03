import express, { ErrorRequestHandler, Router } from 'express';

import { imageRouter } from './images';
import { dataRouter } from './data';
import { buildsRouter } from './builds';
import { error } from '../models/logger';

export const router: Router = express.Router();

router.use('/data', dataRouter);
router.use('/images', imageRouter);
router.use('/builds', buildsRouter);

// Error handling middleware
const errorHandler: ErrorRequestHandler = (err, req, res /* , next */) => {
    error(err.stack);
    res.status(500).send('Internal server error');
};

router.use(errorHandler);

export const apiRouter = router;
