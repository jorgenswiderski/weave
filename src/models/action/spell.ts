import {
    ActionDamageSaveEffect,
    ISpell,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/action';
import { AbilityScore } from '@jorgenswiderski/tomekeeper-shared/dist/types/ability';
import assert from 'assert';
import { PageNotFoundError } from '../errors';
import { MediaWikiTemplate } from '../media-wiki/media-wiki-template';
import { ActionBase } from './action-base';
import { error } from '../logger';
import { MediaWikiTemplateParserConfig } from '../media-wiki/types';

let spellData: Spell[];
let spellDataById: Map<number, Spell> | null = null;

export class Spell extends ActionBase implements Partial<ISpell> {
    classes?: string[];
    damageSave?: AbilityScore;
    damageSaveEffect?: ActionDamageSaveEffect;
    damagePer?: string;
    higherLevels?: string;
    variantNames?: string[];
    variants?: ISpell[];
    variantOf?: string;

    constructor(pageTitle: string) {
        super(pageTitle, 'SpellPage');
    }

    protected async initData(): Promise<void> {
        await super.initData();

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        const { plainText } = MediaWikiTemplate.Parsers;
        const { parseEnum } = MediaWikiTemplate.HighOrderParsers;

        const config: MediaWikiTemplateParserConfig = {
            classes: {
                parser: (value) =>
                    value
                        ?.split(',')
                        .map((c) => c.trim())
                        .filter((c) => c !== '') || [],
                default: [],
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
            variantOf: {
                key: 'variant of',
                default: undefined,
            },
        };

        const template = await this.page.getTemplate(this.templateName);
        Object.assign(this, template.parse(config));

        if (this.classes && this.classes.length > 0) {
            this.markUsed();
        }
    }

    initVariants(): void {
        if (this.variantOf) {
            const primary = spellData.find(
                (s) => s.pageTitle === this.variantOf,
            );

            assert(
                primary,
                `Failed to find primary variant of spell '${this.pageTitle}' '${this.variantOf}'`,
            );
        }

        if (!this.variantNames) {
            return;
        }

        // If a spell has itself has a variant, this indicates there is no "primary" variant
        assert(
            !this.variantNames.includes(this.name!),
            `Spell '${this.name}' should not include itself as a variant`,
        );

        this.variants = this.variantNames.map((pageTitle) => {
            const spell = spellData.find((s) => s.pageTitle === pageTitle);

            assert(
                spell,
                `Failed to find variant of spell '${this.pageTitle}' '${pageTitle}'`,
            );

            return spell!;
        }) as ISpell[];
    }

    toJSON(): Partial<ISpell> {
        const result: Partial<ISpell> = super.toJSON();

        const keys: Array<keyof ISpell> = [
            'classes',
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

export async function initSpellData(spellNames: string[]): Promise<void> {
    spellData = spellNames.map((name) => new Spell(name));
    await Promise.all(spellData.map((spell) => spell.waitForInitialization()));

    spellData.forEach((spell) => spell.initVariants());
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

    return spells.filter((spell) => spell.classes && spell.classes.length > 0);
}
