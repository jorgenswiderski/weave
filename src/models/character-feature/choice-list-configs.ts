import { ChoiceListConfig } from './types';

export const choiceListConfigs: Map<string, ChoiceListConfig> = new Map([
    [
        'Fighting style',
        {
            feature: 'Fighting Style',
            classes: 'Available To',
        },
    ],
    [
        'Bestial Heart',
        {
            name: 'Bestial Hearts',
            feature: 'Grants',
            matchAll: true,
        },
    ],
]);
