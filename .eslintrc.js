module.exports = {
    parserOptions: {
        ecmaVersion: 11,
        sourceType: 'module',
        project: './tsconfig.json',
    },
    extends: ['eslint:recommended', 'airbnb', 'plugin:prettier/recommended'],
    overrides: [
        {
            extends: ['airbnb-typescript', 'prettier'],
            files: ['*.ts', '*.tsx'],
            rules: {
                'import/no-extraneous-dependencies': 'off',
                '@typescript-eslint/lines-between-class-members': 'off',
            },
        },
    ],
    settings: {
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts', '.tsx'],
        },
        'import/resolver': {
            typescript: {
                // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`
                alwaysTryTypes: true,
            },
        },
    },
    env: {
        node: true,
        es2020: true,
    },
    rules: {
        indent: ['error', 4],
        'import/prefer-default-export': 'off',
        'import/no-default-export': 'error',
        'no-console': 'error',
    },
};
