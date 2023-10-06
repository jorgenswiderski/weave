import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { MediaWiki } from './media-wiki';
import { mwnApi } from './api/mwn';
import { getCharacterClassData } from './character-class';

const app = express();
const PORT = process.env.PORT || 3001;

(() => getCharacterClassData())();

app.get('/', (req, res) => {
    res.send('BG3 Character Planner Backend is up and running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
