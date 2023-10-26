import {
    ActionDamageSaveEffect,
    ActionResource,
    ISpell,
} from 'planner-types/src/types/action';
import { AbilityScore } from 'planner-types/src/types/ability';
import { MwnApiClass } from '../../api/mwn';
import { PageNotFoundError } from '../errors';
import {
    MediaWikiTemplateParser,
    MediaWikiTemplateParserConfig,
} from '../mw-template-parser';
import { ActionBase } from './action-base';

let spellData: Spell[];
let spellDataById: Map<number, Spell> | null = null;

export class Spell extends ActionBase implements Partial<ISpell> {
    classes?: string[];
    noSpellSlot?: boolean;
    damageSave?: AbilityScore;
    damageSaveEffect?: ActionDamageSaveEffect;
    damagePer?: string;
    higherLevels?: string;
    variants?: string[];

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
            variants: {
                // FIXME
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
    }

    // hardcoded variants that are tricky to catch with general logic
    static VARIANT_SPELLS = [
        'Enlarge',
        'Reduce',

        // Enhance Ability
        "Bear's Endurance",
        "Bull's Strength",
        "Cat's Grace",
        "Eagle's Splendour",
        "Fox's Cunning",
        "Owl's Wisdom",
    ];

    // Remove spell variants eg "Disguise Self: Femme Human" or "Chromatic Orb: Fire"
    isVariant(): boolean {
        if (!this.name) {
            return false;
        }

        if (Spell.VARIANT_SPELLS.includes(this.name)) {
            return true;
        }

        let shortName: string;

        if (this.name.startsWith('Reapply ')) {
            shortName = this.name.split('Reapply ')[1]!;
        } else {
            shortName = /^[^:(]+/.exec(this.name)![0].trim();
        }

        return (
            spellData.findIndex(
                (spell) => this !== spell && spell.name === shortName,
            ) >= 0
        );
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
        ];

        keys.forEach((key) => {
            if (key in this) {
                result[key] = this[key] as any;
            }
        });

        return result;
    }
}

export async function getSpellData(): Promise<Spell[]> {
    if (!spellData) {
        const classNames = await MwnApiClass.queryTitlesFromCategory('Spells');

        spellData = classNames.map((name) => new Spell(name));
        await Promise.all(spellData.map((cc) => cc.waitForInitialization()));
        spellData = spellData.filter((spell) => !spell.isVariant());

        spellDataById = new Map<number, Spell>();
        spellData.forEach((spell) => spellDataById!.set(spell.id!, spell));
    }

    return spellData;
}

export async function getSpellDataById() {
    if (!spellDataById) {
        await getSpellData();
    }

    return spellDataById!;
}
