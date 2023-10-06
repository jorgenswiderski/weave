import { ICharacterClass } from '../character-class/types';
import { ClassFeature } from './class-feature';
import { ClassSubclass } from './subclass';
import {
    ClassFeatureOther,
    ClassFeatureSpecial,
    ClassFeatureTypes,
    ClassFeatureTypesSpecial,
} from './types';

export class ClassFeatureFactory {
    static construct(
        characterClass: ICharacterClass,
        options: ClassFeatureOther | ClassFeatureSpecial,
    ): ClassFeature {
        if (options.type === ClassFeatureTypes.CHOOSE_SUBCLASS) {
            return new ClassSubclass(characterClass.name);
        }

        return new ClassFeature(options);
    }

    static fromMarkdownString(
        characterClass: ICharacterClass,
        featureText: string,
    ): ClassFeature {
        const specialCases: { [key: string]: ClassFeatureTypesSpecial } = {
            'eldritch invocations': ClassFeatureTypes.NONE,
            'choose a subclass': ClassFeatureTypes.CHOOSE_SUBCLASS,
            'subclass feature': ClassFeatureTypes.SUBCLASS_FEATURE,
            'feats|feat': ClassFeatureTypes.FEAT,
            '#spellcasting': ClassFeatureTypes.SPELLCASTING,
            '#pact magic': ClassFeatureTypes.PACT_MAGIC,
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
                type: ClassFeatureTypes.OTHER,
                pageTitle,
            });
        }

        // Check for SmIconLink style template
        if (featureText.startsWith('{{SmIconLink|')) {
            const parts = featureText.split('|');
            const pageTitle = parts[3].replace('}}', '').trim();
            return ClassFeatureFactory.construct(characterClass, {
                type: ClassFeatureTypes.OTHER,
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
                    type: ClassFeatureTypes.OTHER,
                    pageTitle: parts[parts.length - 1].trim(),
                });
            }
        }

        return ClassFeatureFactory.construct(characterClass, {
            type: ClassFeatureTypes.OTHER,
            pageTitle: featureText.trim(),
        });
    }
}
