import assert from 'assert';
import {
    ActionType,
    ISpell,
    SpellSchool,
} from 'planner-types/src/types/spells';
import { MwnApiClass } from '../../api/mwn';
import { PageNotFoundError } from '../errors';
import { error } from '../logger';
import { MediaWiki } from '../media-wiki';
import { PageItem, PageLoadingState } from '../page-item';

enum SpellLoadState {
    SPELL_DATA = 'SPELL_DATA',
}

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
    // otherData: Record<string, string> = {};

    constructor(pageTitle: string) {
        super({ pageTitle });

        this.initialized[SpellLoadState.SPELL_DATA] =
            this.initData().catch(error);
    }

    private static parseValueFromSpellPageTemplate(
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

        const { content } = this.page;

        this.name = Spell.parseValueFromSpellPageTemplate(content, 'name');

        const image = Spell.parseValueFromSpellPageTemplate(content, 'image');
        this.image = image ? MediaWiki.getImagePath(image) : undefined;

        const levelStr = Spell.parseValueFromSpellPageTemplate(
            content,
            'level',
        );

        this.level = levelStr === 'cantrip' ? 0 : parseInt(levelStr || '0', 10);

        assert(!Number.isNaN(this.level));

        this.school =
            (Spell.parseValueFromSpellPageTemplate(
                content,
                'school',
            )?.toUpperCase() as unknown as SpellSchool) ?? SpellSchool.NONE;

        this.ritual =
            Spell.parseValueFromSpellPageTemplate(content, 'ritual') === 'yes';

        this.classes =
            Spell.parseValueFromSpellPageTemplate(content, 'classes')
                ?.split(',')
                .map((c) => c.trim())
                .filter((c) => c !== '') || [];

        const summary = Spell.parseValueFromSpellPageTemplate(
            content,
            'summary',
        );

        this.summary = summary ? MediaWiki.stripMarkup(summary) : undefined;

        const description = Spell.parseValueFromSpellPageTemplate(
            content,
            'description',
        );

        this.description = description
            ? MediaWiki.stripMarkup(description)
            : undefined;

        this.actionType =
            (Spell.parseValueFromSpellPageTemplate(
                content,
                'action type',
            )?.toUpperCase() as unknown as ActionType) ?? ActionType.NONE;

        this.concentration =
            Spell.parseValueFromSpellPageTemplate(content, 'concentration') ===
            'yes';

        this.noSpellSlot =
            Spell.parseValueFromSpellPageTemplate(content, 'no spell slot') ===
            'yes';
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
        };
    }
}

let spellData: Spell[];

export async function getSpellData(): Promise<Spell[]> {
    if (!spellData) {
        const classNames = await MwnApiClass.queryTitlesFromCategory('Spells');

        spellData = classNames.map((name) => new Spell(name));
        await Promise.all(spellData.map((cc) => cc.waitForInitialization()));

        // Remove spell variants eg "Disguise Self: Femme Human" or "Chromatic Orb: Fire"
        spellData = spellData.filter((spell) => {
            if (!spell.name) {
                return false;
            }

            const shortName = /^[^:(]+/.exec(spell.name)![0];

            return (
                spellData.findIndex(
                    (spell2) => spell !== spell2 && spell2.name === shortName,
                ) < 0
            );
        });
    }

    return spellData;
}
