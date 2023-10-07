export const CONFIG = {
    MWN: {
        MEMOIZATION_DURATION_IN_MILLIS: parseInt(
            process.env.MWN_MEMOIZATION_DURATION_IN_MILLIS ?? '5000',
            10,
        ),
    },
    MEDIAWIKI: {
        REVISION_CHECK_THROTTLE_IN_MILLIS: parseInt(
            process.env.MEDIAWIKI_REVISION_CHECK_THROTTLE_IN_MILLIS ?? '5',
            10,
        ),
        BASE_URL: process.env.MEDIAWIKI_BASE_URL,
    },
};
