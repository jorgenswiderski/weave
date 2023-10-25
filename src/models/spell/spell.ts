import {
    ActionType,
    ISpell,
    SpellSchool,
} from 'planner-types/src/types/spells';
import { MwnApiClass } from '../../api/mwn';
import { PageNotFoundError } from '../errors';
import { error } from '../logger';
import { PageItem, PageLoadingState } from '../page-item';
import {
    MediaWikiTemplateParser,
    MediaWikiTemplateParserConfig,
} from '../mw-template-parser';

enum SpellLoadState {
    SPELL_DATA = 'SPELL_DATA',
}

let spellData: Spell[];
let spellDataById: Map<number, Spell> | null = null;

export class Spell extends PageItem implements Partial<ISpell> {
    name?: string;
    image?: string;
    level?: number;
    school?: SpellSchool;
    ritual?: boolean;
    classes?: string[];
    summary?: string;
    description?: string;
    actionType?: ActionType;
    concentration?: boolean;
    noSpellSlot?: boolean;
    id?: number;

    constructor(pageTitle: string) {
        super({ pageTitle });

        this.initialized[SpellLoadState.SPELL_DATA] =
            this.initData().catch(error);
    }

    static parseValueFromSpellPageTemplate(
        wikitext: string,
        key: string,
    ): string | undefined {
        const regex = new RegExp(`\\|\\s*${key}\\s*=(.*?)\\n\\|`, 'i');
        const match = wikitext.match(regex);

        return match ? match[1].trim() : undefined;
    }

    private async initData(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        this.id = this.page.pageId;

        const { image, plainText, boolean } = MediaWikiTemplateParser.Parsers;
        const { parseEnum } = MediaWikiTemplateParser.HighOrderParsers;

        const config: Record<string, MediaWikiTemplateParserConfig> = {
            name: { parser: plainText, default: this.pageTitle },
            image: {
                parser: image,
                default: undefined,
            },
            level: {
                parser: (value) =>
                    value === 'cantrip' ? 0 : parseInt(value || '0', 10),
                default: 0,
            },
            school: {
                parser: parseEnum(SpellSchool),
                default: SpellSchool.NONE,
            },
            ritual: { parser: boolean, default: false },
            classes: {
                parser: (value) =>
                    value
                        ?.split(',')
                        .map((c) => c.trim())
                        .filter((c) => c !== '') || [],
                default: [],
            },
            summary: {
                parser: plainText,
                default: undefined,
            },
            description: {
                parser: plainText,
                default: undefined,
            },
            actionType: {
                key: 'action type',
                parser: parseEnum(ActionType),
                default: ActionType.NONE,
            },
            concentration: { parser: boolean, default: false },
            noSpellSlot: {
                key: 'no spell slot',
                parser: boolean,
                default: false,
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

    toJSON() {
        return {
            name: this.name,
            image: this.image,
            level: this.level,
            school: this.school,
            ritual: this.ritual,
            classes: this.classes,
            summary: this.summary,
            description: this.description,
            actionType: this.actionType,
            concentration: this.concentration,
            noSpellSlot: this.noSpellSlot,
            id: this.id,
        };
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
