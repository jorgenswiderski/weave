import {
    ActionDamageSaveEffect,
    ActionResource,
    ISpell,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/action';
import { AbilityScore } from '@jorgenswiderski/tomekeeper-shared/dist/types/ability';
import { PageNotFoundError } from '../errors';
import {
    MediaWikiTemplateParser,
    MediaWikiTemplateParserConfig,
} from '../media-wiki/mw-template-parser';
import { ActionBase } from './action-base';
import { error } from '../logger';

let spellData: Spell[];
let spellDataById: Map<number, Spell> | null = null;

export class Spell extends ActionBase implements Partial<ISpell> {
    classes?: string[];
    noSpellSlot?: boolean;
    damageSave?: AbilityScore;
    damageSaveEffect?: ActionDamageSaveEffect;
    damagePer?: string;
    higherLevels?: string;
    variantNames?: string[];
    variants?: ISpell[];
    isVariant: boolean = false;

    protected async initData(): Promise<void> {
        await super.initData();

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        const { plainText, boolean } = MediaWikiTemplateParser.Parsers;
        const { parseEnum } = MediaWikiTemplateParser.HighOrderParsers;

        const config: Record<string, MediaWikiTemplateParserConfig> = {
            classes: {
                parser: (value) =>
                    value
                        ?.split(',')
                        .map((c) => c.trim())
                        .filter((c) => c !== '') || [],
                default: [],
            },
            cost: {
                key: 'action type',
                parser: parseEnum(ActionResource),
                default: undefined,
            },
            noSpellSlot: {
                key: 'no spell slot',
                parser: boolean,
                default: false,
            },
            damageSave: {
                key: 'damage save',
                parser: parseEnum(AbilityScore),
                default: undefined,
            },
            damageSaveEffect: {
                key: 'damage save effect',
                parser: parseEnum(ActionDamageSaveEffect),
                default: ActionDamageSaveEffect.negate,
            },
            damagePer: {
                key: 'damage per',
                parser: plainText,
                default: undefined,
            },
            higherLevels: {
                // FIXME: type is "content"
                key: 'higher levels',
                parser: plainText,
                default: undefined,
            },
            variantNames: {
                key: 'variants',
                parser: (value) => {
                    const variants = value
                        ?.split(',')
                        .map((v) => v.trim())
                        .filter((v) => v.length);

                    return variants.length > 0 ? variants : undefined;
                },
                default: undefined,
            },
        };

        Object.assign(
            this,
            MediaWikiTemplateParser.parseTemplate(this.page, config),
        );

        if (this.classes && this.classes.length > 0) {
            this.markUsed();
        }
    }

    toJSON(): Partial<ISpell> {
        const result: Partial<ISpell> = super.toJSON();

        const keys: Array<keyof ISpell> = [
            'classes',
            'noSpellSlot',
            'damageSave',
            'damageSaveEffect',
            'damagePer',
            'higherLevels',
            'variants',
            'isVariant',
        ];

        keys.forEach((key) => {
            if (key in this) {
                result[key] = this[key] as any;
            }
        });

        return result;
    }
}

export async function initSpellData(spellNames: string[]): Promise<void> {
    spellData = spellNames.map((name) => new Spell(name));
    await Promise.all(spellData.map((cc) => cc.waitForInitialization()));

    // Set variant status
    const variants = new Map<string, Spell>();

    // Remove horizontal variants (siblings)
    // These spells include themself as a variant, so just remove all variants for these spells
    spellData.forEach((spell) => {
        if (spell.variantNames?.includes(spell.name!)) {
            // eslint-disable-next-line no-param-reassign
            delete spell.variantNames;
        }
    });

    spellData
        .filter((spell) => spell.variantNames)
        .flatMap((spell) => spell.variantNames!)
        .forEach((name) =>
            variants.set(name, spellData.find((spell) => spell.name === name)!),
        );

    spellData.forEach((spell) => {
        if (variants.has(spell.name!)) {
            // eslint-disable-next-line no-param-reassign
            spell.isVariant = true;
        }

        if (spell.variantNames) {
            // eslint-disable-next-line no-param-reassign
            spell.variants = spell.variantNames.map(
                (name) => variants.get(name)!,
            ) as ISpell[];
        }
    });

    spellDataById = new Map<number, Spell>();

    spellData.forEach((spell) => {
        if (spellDataById!.has(spell.id!)) {
            const other = spellDataById!.get(spell.id!)!;

            error(
                `Spell data conflict between ${other.pageTitle} (${other.id}) and ${spell.pageTitle} (${spell.id})`,
            );
        }

        spellDataById!.set(spell.id!, spell);
    });
}

async function waitForInit(): Promise<void> {
    const executor = (resolve: any) => {
        if (spellData) {
            resolve();

            return;
        }

        setTimeout(() => executor(resolve), 500);
    };

    return new Promise(executor);
}

export async function getSpellData(): Promise<Spell[]> {
    await waitForInit();

    return spellData;
}

export async function getSpellDataById() {
    await waitForInit();

    return spellDataById!;
}

export async function getSpellDataFiltered(): Promise<Spell[]> {
    const spells = await getSpellData();

    return spells.filter(
        (spell) => spell.used || (spell.classes && spell.classes.length > 0),
    );
}
