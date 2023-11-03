import express, { Router } from 'express';

import { ImageClassController } from '../controller/image-cache';

const router: Router = express.Router();
router.use(express.json());

router.get('/:imageName', ImageClassController.getImage);
router.post('/resize/:imageName', ImageClassController.resizePreloadImage);

export const imageRouter = router;
