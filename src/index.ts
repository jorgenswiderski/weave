/* eslint-disable import/first */
import dotenv from 'dotenv';

dotenv.config();

if (process.env.ENVIRONMENT !== 'dev') {
    import('newrelic');
}

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
import { initLocations } from './models/locations/locations';
import { initPassives } from './models/characteristic/characteristic';

async function main() {
    log('=====================================================');
    warn('Weave is starting...');
    log('=====================================================');

    new MwnProgressBar().render();

    await Promise.all([
        initActionsAndSpells(),
        initLocations(),
        initPassives(),
    ]);

    await Promise.all([
        getCharacterClassData(),
        getCharacterRaceData(),
        getCharacterBackgroundData(),
        getEquipmentItemData(),
    ]);

    const app = express();
    const PORT = process.env.PORT || 3001;

    // Trust NGINX reverse proxy
    app.set('trust proxy', '172.16.0.0/12');

    const allowedOrigins = [
        'http://localhost:3000',
        'https://tomekeeper.vercel.app',
        /^https:\/\/netherview-.*-jorgenswiderskis-projects\.vercel\.app$/,
    ];

    app.use(
        cors({
            origin(origin, callback) {
                // Allow requests with no origin (like mobile apps or curl requests)
                if (!origin) return callback(null, true);

                if (
                    allowedOrigins.some((pattern) =>
                        pattern instanceof RegExp
                            ? pattern.test(origin)
                            : pattern === origin,
                    )
                ) {
                    return callback(null, true);
                }

                warn(`Denied request from disallowed origin: ${origin}`);
                const msg = `The CORS policy for this site does not allow access from the specified Origin.`;

                return callback(new Error(msg), false);
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

    app.use('/api', apiRouter);

    app.listen(PORT, () => {
        log('=====================================================');
        warn('Weave is ready!');
        log(`Server is running on port ${PORT}`);
        log('=====================================================');
    });
}

main();
