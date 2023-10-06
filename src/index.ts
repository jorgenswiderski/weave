import dotenv from 'dotenv';

dotenv.config();

/* eslint-disable import/first */
import express from 'express';
import { getCharacterClassData } from './models/character-class/character-class';
import { log } from './models/logger';

const app = express();
const PORT = process.env.PORT || 3001;

(() => getCharacterClassData())();

app.get('/', (req, res) => {
    res.send('BG3 Character Planner Backend is up and running!');
});

app.listen(PORT, () => {
    log(`Server is running on port ${PORT}`);
});
