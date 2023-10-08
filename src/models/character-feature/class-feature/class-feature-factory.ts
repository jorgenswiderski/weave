import { ICharacterClass } from '../../character-class/types';
import { CharacterFeature } from '../character-feature';
import { ClassSubclass } from './subclass';
import { CharacterFeatureTypes } from '../types';
import {
    ClassFeatureOther,
    ClassFeatureSpecial,
    ClassFeatureTypesSpecial,
} from './types';

export class ClassFeatureFactory {
    static construct(
        characterClass: ICharacterClass,
        options: ClassFeatureOther | ClassFeatureSpecial,
    ): CharacterFeature {
        if (options.type === CharacterFeatureTypes.CHOOSE_SUBCLASS) {
            return new ClassSubclass(characterClass.name);
        }

        return new CharacterFeature(options);
    }

    static fromMarkdownString(
        characterClass: ICharacterClass,
        featureText: string,
    ): CharacterFeature {
        const specialCases: { [key: string]: ClassFeatureTypesSpecial } = {
            'eldritch invocations': CharacterFeatureTypes.NONE,
            'choose a subclass': CharacterFeatureTypes.CHOOSE_SUBCLASS,
            'subclass feature': CharacterFeatureTypes.SUBCLASS_FEATURE,
            'feats|feat': CharacterFeatureTypes.FEAT,
            '#spellcasting': CharacterFeatureTypes.SPELLCASTING,
            '#pact magic': CharacterFeatureTypes.PACT_MAGIC,
        };

        // Handle special labels
        // eslint-disable-next-line no-restricted-syntax
        for (const [caseText, caseType] of Object.entries(specialCases)) {
            if (featureText.toLowerCase().includes(caseText)) {
                return ClassFeatureFactory.construct(characterClass, {
                    type: caseType,
                });
            }
        }

        // Remove icons
        if (featureText.startsWith('{{Icon')) {
            // eslint-disable-next-line no-param-reassign, prefer-destructuring
            featureText = featureText.split('}} ')[1];
        }

        // Check for SAI style template
        if (featureText.startsWith('{{SAI|')) {
            const parts = featureText.split('|');

            const pageTitle = parts[1].split('}}')[0].trim();

            return ClassFeatureFactory.construct(characterClass, {
                type: CharacterFeatureTypes.OTHER,
                pageTitle,
            });
        }

        // Check for SmIconLink style template
        if (featureText.startsWith('{{SmIconLink|')) {
            const parts = featureText.split('|');
            const pageTitle = parts[3].replace('}}', '').trim();

            return ClassFeatureFactory.construct(characterClass, {
                type: CharacterFeatureTypes.OTHER,
                pageTitle,
            });
        }

        // Extract link labels or whole links
        const linkPattern = /\[\[(.*?)\]\]/;

        if (linkPattern.test(featureText)) {
            const match = featureText.match(linkPattern);

            if (match) {
                const parts = match[1].split('|');

                // Take the linked page title and discard the non-link text
                return ClassFeatureFactory.construct(characterClass, {
                    type: CharacterFeatureTypes.OTHER,
                    pageTitle: parts[parts.length - 1].trim(),
                });
            }
        }

        return ClassFeatureFactory.construct(characterClass, {
            type: CharacterFeatureTypes.OTHER,
            pageTitle: featureText.trim(),
        });
    }
}
