export enum ClassFeatureTypes {
    CHOOSE_SUBCLASS = 'CHOOSE_SUBCLASS',
    FEAT = 'FEAT',
    SUBCLASS_FEATURE = 'SUBCLASS_FEATURE',
    OTHER = 'OTHER',
}

interface ClassFeatureBase {
    type: ClassFeatureTypes;
}

export interface ClassFeatureOther extends ClassFeatureBase {
    type: ClassFeatureTypes.OTHER;
    pageTitle: string;
}

export interface ClassFeatureSpecial extends ClassFeatureBase {
    type:
        | ClassFeatureTypes.CHOOSE_SUBCLASS
        | ClassFeatureTypes.FEAT
        | ClassFeatureTypes.SUBCLASS_FEATURE;
}

export type ClassFeature = ClassFeatureOther | ClassFeatureSpecial;

export function parseClassFeature(featureText: string): ClassFeature {
    // Handle special labels
    if (featureText.includes('Choose a subclass')) {
        return { type: ClassFeatureTypes.CHOOSE_SUBCLASS };
    } else if (featureText.includes('Subclass feature')) {
        return { type: ClassFeatureTypes.SUBCLASS_FEATURE };
    } else if (featureText.includes('Feats|Feat')) {
        return { type: ClassFeatureTypes.FEAT };
    }

    // Check for SAI style template
    if (featureText.startsWith('{{SAI|')) {
        const parts = featureText.split('|');
        const pageTitle = (
            parts[2] ? parts[2].replace('}}', '') : parts[1].replace('}}', '')
        ).trim();
        return { type: ClassFeatureTypes.OTHER, pageTitle: pageTitle };
    }

    // Check for SmIconLink style template
    if (featureText.startsWith('{{SmIconLink|')) {
        const parts = featureText.split('|');
        const pageTitle = parts[3].replace('}}', '').trim();
        return { type: ClassFeatureTypes.OTHER, pageTitle: pageTitle };
    }

    // Extract link labels or whole links
    if (featureText.includes('[') && featureText.includes(']')) {
        const parts = featureText.split('|');
        const pageTitle = parts[1]
            ? parts[1].replace(']]', '').trim()
            : parts[0].replace('[[', '').replace(']]', '').trim();
        return { type: ClassFeatureTypes.OTHER, pageTitle: pageTitle };
    }

    return { type: ClassFeatureTypes.OTHER, pageTitle: featureText.trim() }; // Default return
}
