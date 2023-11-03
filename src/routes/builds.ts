import express from 'express';
import { BuildsController } from '../controller/builds';

const router = express.Router();
router.use(express.json());

router.post('/create', BuildsController.create);
router.delete('/delete/:id', BuildsController.delete);
router.put('/update/:id', BuildsController.update);
router.get('/get/:id', BuildsController.get);

export const buildsRouter = router;
