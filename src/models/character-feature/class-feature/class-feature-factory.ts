import assert from 'assert';
import { CompressableRecord } from '@jorgenswiderski/tomekeeper-shared/dist/models/compressable-record/types';
import { ICharacterClass } from '../../character-class/types';
import { CharacterFeature } from '../character-feature';
import { CharacterFeat } from '../features/character-feat';
import { ClassSubclass } from '../features/character-subclass';
import { CharacterFeatureTypes, ICharacterOptionWithPage } from '../types';
import { ActionStub } from '../../static-reference/action-stub';
import { SpellStub } from '../../static-reference/spell-stub';

export class ClassFeatureFactory {
    static async construct(
        characterClass: ICharacterClass,
        type: CharacterFeatureTypes,
        options: ICharacterOptionWithPage,
        level: number,
    ): Promise<CharacterFeature | CompressableRecord> {
        if (
            type === CharacterFeatureTypes.CHOOSE_SUBCLASS ||
            type === CharacterFeatureTypes.SUBCLASS_FEATURE
        ) {
            return new ClassSubclass(characterClass.name, type, level);
        }

        if (type === CharacterFeatureTypes.FEAT) {
            return new CharacterFeat();
        }

        const cf = new CharacterFeature(options);

        // Wait for grants to be initialized
        await cf.waitForInitialization();

        // If grants is an ActionStub or SpellStub, those are actually
        // decisions not grantable effects, so let's just return that instead
        // otherwise we'd be granting a decision which isn't allowed.
        assert(cf.grants.length <= 1);

        // This is a bit of a hacky solution. Ideally we would just directly
        // create the stub here and return it, but all the parsing for this
        // lives in character feature so this is a lot easier.

        if (
            cf.grants[0] instanceof ActionStub ||
            cf.grants[0] instanceof SpellStub
        ) {
            return cf.grants[0];
        }

        return cf;
    }

    static parserSpecialCases: {
        [key: string]: { type: CharacterFeatureTypes; pageTitle?: string };
    } = {
        'eldritch invocations': { type: CharacterFeatureTypes.NONE },
        'choose a subclass': {
            type: CharacterFeatureTypes.CHOOSE_SUBCLASS,
        },
        '|subclass feature': {
            type: CharacterFeatureTypes.SUBCLASS_FEATURE,
        },
        'feats|feat': { type: CharacterFeatureTypes.FEAT, pageTitle: 'Feats' },
        '#spellcasting': { type: CharacterFeatureTypes.SPELLCASTING },
        '#pact magic': { type: CharacterFeatureTypes.PACT_MAGIC },
    };

    static fromMarkdownString(
        characterClass: ICharacterClass,
        featureText: string,
        level: number,
    ): Promise<CharacterFeature | CompressableRecord> {
        // Handle special labels
        // eslint-disable-next-line no-restricted-syntax
        for (const [caseText, data] of Object.entries(
            ClassFeatureFactory.parserSpecialCases,
        )) {
            if (featureText.toLowerCase().includes(caseText)) {
                return ClassFeatureFactory.construct(
                    characterClass,
                    data.type,
                    {
                        name: caseText,
                        pageTitle: data.pageTitle,
                    },
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

            return ClassFeatureFactory.construct(
                characterClass,
                CharacterFeatureTypes.OTHER,
                {
                    name: pageTitle,
                    pageTitle,
                },
                level,
            );
        }

        // Check for SmIconLink style template
        if (featureText.startsWith('{{SmIconLink|')) {
            const parts = featureText.split('|');
            const pageTitle = parts[3].replace('}}', '').trim();

            return ClassFeatureFactory.construct(
                characterClass,
                CharacterFeatureTypes.OTHER,
                {
                    name: pageTitle,
                    pageTitle,
                },
                level,
            );
        }

        // Extract link labels or whole links
        const linkPattern = /\[\[(.*?)\]\]/;

        if (linkPattern.test(featureText)) {
            const match = featureText.match(linkPattern);

            if (match) {
                const parts = match[1].split('|');

                // Take the linked page title and discard the non-link text
                return ClassFeatureFactory.construct(
                    characterClass,
                    CharacterFeatureTypes.OTHER,
                    {
                        name: parts[parts.length - 1].trim(),
                        pageTitle: parts[parts.length - 1].trim(),
                    },
                    level,
                );
            }
        }

        return ClassFeatureFactory.construct(
            characterClass,
            CharacterFeatureTypes.OTHER,
            {
                name: featureText.trim(),
                pageTitle: featureText.trim(),
            },
            level,
        );
    }
}
