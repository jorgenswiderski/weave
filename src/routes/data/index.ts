import express, { Router } from 'express';
import { itemsRouter } from './items';
import { actionsRouter } from './actions';
import { backgroundsRouter } from './backgrounds';
import { classesRouter } from './classes';
import { racesRouter } from './races';
import { spellsRouter } from './spells';

export const router: Router = express.Router();

router.use('/classes', classesRouter);
router.use('/races', racesRouter);
router.use('/backgrounds', backgroundsRouter);
router.use('/actions', actionsRouter);
router.use('/spells', spellsRouter);
router.use('/items', itemsRouter);

export const dataRouter = router;
