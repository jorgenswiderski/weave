import { PageItem } from './page-item';

export enum ClassFeatureTypes {
    NONE = 'NONE',
    CHOOSE_SUBCLASS = 'CHOOSE_SUBCLASS',
    FEAT = 'FEAT',
    SUBCLASS_FEATURE = 'SUBCLASS_FEATURE',
    SPELLCASTING = 'SPELLCASTING',
    PACT_MAGIC = 'PACT_MAGIC',
    OTHER = 'OTHER',
}

interface ClassFeatureBase {
    type: ClassFeatureTypes;
}

export interface ClassFeatureOther extends ClassFeatureBase {
    type: ClassFeatureTypes.OTHER;
    pageTitle: string;
}

type ClassFeatureTypesSpecial =
    | ClassFeatureTypes.NONE
    | ClassFeatureTypes.CHOOSE_SUBCLASS
    | ClassFeatureTypes.FEAT
    | ClassFeatureTypes.SUBCLASS_FEATURE
    | ClassFeatureTypes.SPELLCASTING
    | ClassFeatureTypes.PACT_MAGIC;

export interface ClassFeatureSpecial extends ClassFeatureBase {
    type: ClassFeatureTypesSpecial;
    pageTitle?: string;
}

export class ClassFeature extends PageItem implements ClassFeatureBase {
    type: ClassFeatureTypes;
    pageTitle?: string;

    constructor(options: ClassFeatureOther | ClassFeatureSpecial) {
        super(options?.pageTitle);

        this.type = options.type;
    }

    static fromMarkdownString(featureText: string): ClassFeature {
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
                return new ClassFeature({
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
            return new ClassFeature({
                type: ClassFeatureTypes.OTHER,
                pageTitle,
            });
        }

        // Check for SmIconLink style template
        if (featureText.startsWith('{{SmIconLink|')) {
            const parts = featureText.split('|');
            const pageTitle = parts[3].replace('}}', '').trim();
            return new ClassFeature({
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
                return new ClassFeature({
                    type: ClassFeatureTypes.OTHER,
                    pageTitle: parts[parts.length - 1].trim(),
                });
            }
        }

        return new ClassFeature({
            type: ClassFeatureTypes.OTHER,
            pageTitle: featureText.trim(),
        });
    }
}
