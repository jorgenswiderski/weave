import express, { Router } from 'express';
import { itemsRouter } from './items';
import { actionsRouter } from './actions';
import { backgroundsRouter } from './backgrounds';
import { classesRouter } from './classes';
import { racesRouter } from './races';
import { spellsRouter } from './spells';
import { passivesRouter } from './passives';
import { Middleware } from '../middleware';

export const router: Router = express.Router();

router.use(Middleware.lruCache, Middleware.intern);

router.use('/actions', actionsRouter);
router.use('/backgrounds', backgroundsRouter);
router.use('/classes', classesRouter);
router.use('/items', itemsRouter);
router.use('/passives', passivesRouter);
router.use('/races', racesRouter);
router.use('/spells', spellsRouter);

export const dataRouter = router;
