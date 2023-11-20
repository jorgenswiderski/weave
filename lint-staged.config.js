module.exports = {
    'src/**/*': 'scripts/dump-data-check.sh',
    '*.{js,jsx,ts,tsx}': [
        'eslint . --ext .js,.ts --cache',
        'npm run format',
        // () => 'npm run type-check',
        'npm run test',
    ],
};
