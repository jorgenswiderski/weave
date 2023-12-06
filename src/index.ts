/* eslint-disable import/first */
import dotenv from 'dotenv';

dotenv.config();

if (process.env.ENVIRONMENT !== 'dev') {
    import('newrelic');
}

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { error, log, warn } from './models/logger';
import { MwnProgressBar } from './api/mwn-progress-bar';
import { apiRoutes } from './routes';
import { initData } from './models/init-data';
import { CONFIG } from './models/config';

async function main() {
    log('=====================================================');
    warn('Weave is starting...');
    log('=====================================================');

    const startTime = Date.now();
    new MwnProgressBar().render();
    await initData();

    const fastify = Fastify({
        logger: { level: 'warn' },
        trustProxy: '172.16.0.0/12', // Trust NGINX reverse proxy
    });

    const allowedOrigins = [
        'http://localhost:3000',
        'https://tomekeeper.vercel.app',
        /^https:\/\/netherview-.*-jorgenswiderskis-projects\.vercel\.app$/,
    ];

    fastify.register(cors, {
        origin: (origin, callback) => {
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
    });

    fastify.register(apiRoutes, { prefix: '/api' });

    const { PORT: port } = CONFIG.HTTP;

    try {
        await fastify.listen({
            port,
            // Bind to all network interfaces, exposing the server to outside the docker container
            host: '0.0.0.0',
        });

        log('=====================================================');
        warn(`Weave is ready in ${(Date.now() - startTime) / 1000}s!`);
        log(`Server is running on port ${port}`);
        log('=====================================================');
    } catch (err) {
        error(err);
        process.exit(1);
    }
}

main();
