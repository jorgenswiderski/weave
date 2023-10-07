import dotenv from 'dotenv';

dotenv.config();

/* eslint-disable import/first */
import express from 'express';
import cors from 'cors';
import { getCharacterClassData } from './models/character-class/character-class';
import { log } from './models/logger';

import { classesRouter } from './routes/classes';

const app = express();
const PORT = process.env.PORT || 3001;

(() => getCharacterClassData())();

app.use(
    cors({
        origin: 'http://localhost:3000', // Replace with your frontend's address. Use '*' to allow any origin (not recommended for production).
        methods: ['GET', 'POST'], // Specify which methods are allowed
        allowedHeaders: ['Content-Type', 'Authorization'],
    }),
);

app.use('/api/classes', classesRouter);

app.listen(PORT, () => {
    log(`Server is running on port ${PORT}`);
});
