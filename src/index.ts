if (process.env.ENVIRONMENT !== 'dev') {
    import('newrelic');
}

/* eslint-disable import/first */
import dotenv from 'dotenv';

dotenv.config();

import express from 'express';
import cors from 'cors';
import { getCharacterClassData } from './models/character-class/character-class';
import { log, warn } from './models/logger';
import { getCharacterRaceData } from './models/character-feature/features/character-race';
import { getCharacterBackgroundData } from './models/character-feature/features/character-background';
import { MwnProgressBar } from './api/mwn-progress-bar';
import { getEquipmentItemData } from './models/equipment/equipment';
import { initActionsAndSpells } from './models/action/init';
import { apiRouter } from './routes';

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

    log('=============================================================');
    warn('Weave is ready!');
    log('=============================================================');
})();

new MwnProgressBar().render();

const allowedOrigins = [
    'http://localhost:3000',
    'https://tomekeeper.vercel.app',
];

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
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'Baggage',
            'Sentry-Trace',
        ],
    }),
);

app.use(express.json());

app.use('/api', apiRouter);

app.listen(PORT, () => {
    log(`Server is running on port ${PORT}`);
});
