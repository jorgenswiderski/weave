module.exports = {
    '*.{js,jsx,ts,tsx}': [
        'eslint . --ext .js,.ts --cache',
        (filenames) => `prettier --write ${filenames.join(' ')}`,
        () => 'npm run type-check',
        'npm run test',
    ],
    '*.{json}': (filenames) =>
        filenames.length
            ? `prettier --write ${filenames.join(' ')}`
            : 'echo "No JSON files to format"',
};
