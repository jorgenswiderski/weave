import dotenv from 'dotenv';

dotenv.config();

/* eslint-disable import/first */
import express from 'express';
import cors from 'cors';
import { getCharacterClassData } from './models/character-class/character-class';
import { log } from './models/logger';

import { classesRouter } from './routes/classes';
import { getCharacterRaceData } from './models/character-feature/features/character-race';
import { racesRouter } from './routes/races';
import { getCharacterBackgroundData } from './models/character-feature/features/character-background';
import { backgroundsRouter } from './routes/backgrounds';
import { MwnProgressBar } from './api/mwn-progress-bar';
import { imageRouter } from './routes/image';
import { spellsRouter } from './routes/spells';
import { itemsRouter } from './routes/items';
import { getEquipmentItemData } from './models/equipment/equipment';
import { initActionsAndSpells } from './models/action/init';
import { actionsRouter } from './routes/actions';

const app = express();
const PORT = process.env.PORT || 3001;

(async () => {
    await initActionsAndSpells();

    await Promise.all([
        getCharacterClassData(),
        getCharacterRaceData(),
        getCharacterBackgroundData(),
        getEquipmentItemData(),
    ]);
})();

new MwnProgressBar().render();

const allowedOrigins = ['http://localhost:3000'];

app.use(
    cors({
        origin(origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            if (allowedOrigins.indexOf(origin) === -1) {
                log(origin);
                const msg = `The CORS policy for this site does not allow access from the specified Origin.`;

                return callback(new Error(msg), false);
            }

            return callback(null, true);
        },
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }),
);

app.use('/api/classes', classesRouter);
app.use('/api/races', racesRouter);
app.use('/api/backgrounds', backgroundsRouter);
app.use('/api/actions', actionsRouter);
app.use('/api/spells', spellsRouter);
app.use('/api/items', itemsRouter);

app.use('/api/images', imageRouter);

app.listen(PORT, () => {
    log(`Server is running on port ${PORT}`);
});
