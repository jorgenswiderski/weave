/* eslint-disable import/first */
import dotenv from 'dotenv';

dotenv.config();

if (process.env.ENVIRONMENT !== 'dev') {
    import('newrelic');
}

import express from 'express';
import cors from 'cors';
import { log, warn } from './models/logger';
import { MwnProgressBar } from './api/mwn-progress-bar';
import { apiRouter } from './routes';
import { initData } from './models/init-data';

async function main() {
    log('=====================================================');
    warn('Weave is starting...');
    log('=====================================================');

    const startTime = Date.now();
    new MwnProgressBar().render();
    await initData();

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
        warn(`Weave is ready in ${(Date.now() - startTime) / 1000}s!`);
        log(`Server is running on port ${PORT}`);
        log('=====================================================');
    });
}

main();
