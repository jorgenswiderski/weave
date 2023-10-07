import dotenv from 'dotenv';

dotenv.config();

/* eslint-disable import/first */
import express from 'express';
import { getCharacterClassData } from './models/character-class/character-class';
import { log } from './models/logger';

import { classesRouter } from './routes/classes';

const app = express();
const PORT = process.env.PORT || 3001;

(() => getCharacterClassData())();

app.use('/api/classes', classesRouter);

app.listen(PORT, () => {
    log(`Server is running on port ${PORT}`);
});
