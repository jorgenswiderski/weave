import { ICharacterClass } from '../../character-class/types';
import { error, warn } from '../../logger';
import { MediaWikiParser } from '../../media-wiki/media-wiki-parser';
import { CharacterFeature } from '../character-feature';
import { CharacterFeat } from '../features/character-feat';
import { ClassSubclassOption } from '../features/character-subclass-option';
import {
    CharacterFeatureSorcererMetamagic,
    CharacterFeatureWarlockEldritchInvocation,
} from '../features/special/special';
import { CharacterFeatureTypes, ICharacterOptionWithPage } from '../types';
import { IClassFeatureFactory } from './types';

class ClassFeatureFactorySingleton implements IClassFeatureFactory {
    protected static async construct(
        type:
            | CharacterFeatureTypes.CHOOSE_SUBCLASS
            | CharacterFeatureTypes.SUBCLASS_FEATURE,
        options: ICharacterOptionWithPage,
        characterClass: ICharacterClass,
        level: number,
    ): Promise<CharacterFeature>;
    protected static async construct(
        type: Omit<
            CharacterFeatureTypes,
            | CharacterFeatureTypes.CHOOSE_SUBCLASS
            | CharacterFeatureTypes.SUBCLASS_FEATURE
        >,
        options: ICharacterOptionWithPage,
        characterClass?: ICharacterClass,
        level?: number,
    ): Promise<CharacterFeature>;
    protected static async construct(
        type: CharacterFeatureTypes,
        options: ICharacterOptionWithPage,
        characterClass?: ICharacterClass,
        level?: number,
    ): Promise<CharacterFeature> {
        if (
            type === CharacterFeatureTypes.CHOOSE_SUBCLASS ||
            type === CharacterFeatureTypes.SUBCLASS_FEATURE
        ) {
            if (!characterClass || !level) {
                throw new Error(
                    `Class and level should be defined when constructing a subclass feature!`,
                );
            }

            return new ClassSubclassOption(characterClass.name, type, level);
        }

        if (type === CharacterFeatureTypes.FEAT) {
            return new CharacterFeat();
        }

        if (type === CharacterFeatureTypes.SORCERER_METAMAGIC) {
            return new CharacterFeatureSorcererMetamagic(options, level);
        }

        if (type === CharacterFeatureTypes.WARLOCK_ELDRITCH_INVOCATION) {
            return new CharacterFeatureWarlockEldritchInvocation(
                options,
                level,
            );
        }

        return new CharacterFeature(options, level, characterClass);
    }

    protected parserSpecialCases: {
        [key: string]: { type: CharacterFeatureTypes; pageTitle?: string };
    } = {
        'choose a subclass': {
            type: CharacterFeatureTypes.CHOOSE_SUBCLASS,
        },
        '|subclass feature': {
            type: CharacterFeatureTypes.SUBCLASS_FEATURE,
        },
        'feats|feat': { type: CharacterFeatureTypes.FEAT, pageTitle: 'Feats' },
        '#spellcasting': { type: CharacterFeatureTypes.SPELLCASTING },
        '#pact magic': { type: CharacterFeatureTypes.PACT_MAGIC },
        '|metamagic}}': {
            type: CharacterFeatureTypes.SORCERER_METAMAGIC,
            pageTitle: 'Metamagic',
        },
        'eldritch invocation': {
            type: CharacterFeatureTypes.WARLOCK_ELDRITCH_INVOCATION,
            pageTitle: 'Eldritch Invocation',
        },
    };

    fromWikitext(
        featureText: string,
        characterClass?: ICharacterClass,
        level?: number,
    ): Promise<CharacterFeature> {
        // Handle special labels
        // eslint-disable-next-line no-restricted-syntax
        for (const [caseText, data] of Object.entries(
            this.parserSpecialCases,
        )) {
            if (featureText.toLowerCase().includes(caseText)) {
                return ClassFeatureFactorySingleton.construct(
                    data.type,
                    {
                        name: data.pageTitle
                            ? MediaWikiParser.parseNameFromPageTitle(
                                  data.pageTitle,
                              )
                            : caseText,
                        pageTitle: data.pageTitle,
                    },
                    characterClass,
                    level,
                );
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

            return ClassFeatureFactorySingleton.construct(
                CharacterFeatureTypes.OTHER,
                {
                    name: MediaWikiParser.parseNameFromPageTitle(pageTitle),
                    pageTitle,
                },
                characterClass,
                level,
            );
        }

        // Check for SmIconLink style template
        if (featureText.startsWith('{{SmIconLink|')) {
            const parts = featureText.split('|');
            const pageTitle = parts[3].replace('}}', '').trim();

            return ClassFeatureFactorySingleton.construct(
                CharacterFeatureTypes.OTHER,
                {
                    name: MediaWikiParser.parseNameFromPageTitle(pageTitle),
                    pageTitle,
                },
                characterClass,
                level,
            );
        }

        // Extract link labels or whole links
        const linkPattern = /\[\[([^|]+).*?]]/;

        if (linkPattern.test(featureText)) {
            const match = featureText.match(linkPattern);

            if (match?.[1]) {
                const featureName = match[1].trim();

                const msg = `${characterClass?.name} feature '${featureText}' has a section link`;

                if (featureName.startsWith('#')) {
                    error(msg);
                } else {
                    if (featureName.includes('#')) {
                        warn(msg);
                    }

                    return ClassFeatureFactorySingleton.construct(
                        CharacterFeatureTypes.OTHER,
                        {
                            name: MediaWikiParser.parseNameFromPageTitle(
                                featureName,
                            ),
                            pageTitle: featureName,
                        },
                        characterClass,
                        level,
                    );
                }
            }
        }

        return ClassFeatureFactorySingleton.construct(
            CharacterFeatureTypes.OTHER,
            {
                name: MediaWikiParser.parseNameFromPageTitle(
                    featureText.trim(),
                ),
                pageTitle: featureText.trim(),
            },
            characterClass,
            level,
        );
    }
}

export const ClassFeatureFactory = new ClassFeatureFactorySingleton();
CharacterFeature.factory = ClassFeatureFactory;
