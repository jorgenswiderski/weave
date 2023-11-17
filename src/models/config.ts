import { CONFIG as SharedConfig } from '@jorgenswiderski/tomekeeper-shared/dist/models/config';

export const CONFIG = {
    ...SharedConfig,

    IS_DEV: process.env.ENVIRONMENT === 'dev',
    MWN: {
        MEMOIZATION_DURATION_IN_MILLIS: parseInt(
            process.env.MWN_MEMOIZATION_DURATION_IN_MILLIS ?? '5000',
            10,
        ),
        REQUEST_BATCHING_WINDOW_IN_MILLIS: parseInt(
            process.env.MWN_REQUEST_BATCHING_WINDOW_IN_MILLIS ?? '100',
            10,
        ),
    },
    MEDIAWIKI: {
        REVISION_CHECK_THROTTLE_IN_MILLIS: parseInt(
            process.env.MEDIAWIKI_REVISION_CHECK_THROTTLE_IN_MILLIS ?? '5',
            10,
        ),
        REVISION_CHECK_THROTTLE_VARIANCE: parseFloat(
            process.env.MEDIAWIKI_REVISION_CHECK_THROTTLE_VARIANCE ?? '0.1',
        ),
        BASE_URL: process.env.MEDIAWIKI_BASE_URL,
        USE_LOCAL_IMAGE_CACHE: process.env.USE_LOCAL_IMAGE_CACHE === 'true',
        IMAGE_CACHE_DURATION: parseInt(
            process.env.MEDIAWIKI_IMAGE_CACHE_DURATION ?? '172800000',
            10,
        ),
        IMAGE_CACHE_REFRESH_TIME: parseInt(
            process.env.MEDIAWIKI_IMAGE_CACHE_REFRESH_TIME ?? '86400000',
            10,
        ),
        USE_LOCKED_REVISIONS: process.env.USE_LOCKED_REVISIONS === 'true',
    },
    SELF_BASE_URL: process.env.SELF_BASE_URL,
    BUILDS: {
        MAX_ENCODED_BUILD_LENGTH: parseInt(
            process.env.BUILDS_MAX_ENCODED_LENGTH ?? '10240',
            10,
        ),
        MAX_BUILD_CREATED_RECENTLY: parseInt(
            process.env.BUILDS_MAX_CREATED_RECENTLY ?? '50',
            10,
        ),
        RECENCY_WINDOW_IN_MILLIS: parseInt(
            process.env.BUILDS_RECENCY_WINDOW_IN_MILLIS ?? '604800000',
            10,
        ),
    },

    MONGO: {
        USERNAME: process.env.MONGO_USERNAME,
        PASSWORD: process.env.MONGO_PASSWORD,
        HOST: process.env.MONGO_HOST,
        PORT: process.env.MONGO_PORT,
    },
};
