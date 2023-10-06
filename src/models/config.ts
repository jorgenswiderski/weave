export const CONFIG = {
    MWN: {
        MEMOIZATION_DURATION_IN_MILLIS: parseInt(
            process.env.MWN_MEMOIZATION_DURATION_IN_MILLIS ?? '5000',
            10,
        ),
    },
};
