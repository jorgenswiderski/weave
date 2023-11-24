import {
    ActionCostBehavior,
    ActionDamageSaveEffect,
    ActionResource,
    ActionResourceFromString,
    ISpell,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/action';
import { AbilityScore } from '@jorgenswiderski/tomekeeper-shared/dist/types/ability';
import { PageNotFoundError } from '../errors';
import { MediaWikiTemplate } from '../media-wiki/media-wiki-template';
import { ActionBase } from './action-base';
import { error } from '../logger';
import {
    MediaWikiTemplateParserConfigItem,
    MediaWikiTemplateParserConfig,
    IPageData,
} from '../media-wiki/types';

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

    constructor(pageTitle: string) {
        super(pageTitle, 'SpellPage');
    }

    protected async parseCosts(): Promise<void> {
        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        const actionResourceParser = (
            value: string,
            config: MediaWikiTemplateParserConfigItem,
            page: IPageData,
        ) => {
            const values = value.split(',').map((val) => val.trim());

            if (
                !values.every(
                    (val) => value === '' || val in ActionResourceFromString,
                )
            ) {
                error(
                    `Failed to map '${config.key}' value '${value}' to enum (${page.title}).`,
                );
            }

            const isHitCost = value === 'hit cost';

            return values.map((val) => ({
                resource: ActionResourceFromString[val],
                amount: 1,
                behavior: isHitCost ? ActionCostBehavior.onHit : undefined,
            }));
        };

        // FIXME
        const defaultCost = [{ resource: ActionResource.action, amount: 1 }];

        if (this.level && this.level > 0) {
            defaultCost.push({
                resource: ActionResource[
                    `spellSlot${this.level}` as any
                ] as unknown as ActionResource,
                amount: 1,
            });
        }

        const config: MediaWikiTemplateParserConfig = {
            cost: {
                parser: actionResourceParser,
                default: defaultCost,
            },
            hitCost: {
                key: 'hit cost',
                parser: actionResourceParser,
                default: [],
            },
        };

        const template = await this.page.getTemplate(this.templateName);
        const { cost, hitCost } = template.parse(config);
        this.costs = [...cost, ...hitCost];
    }

    protected async initData(): Promise<void> {
        await super.initData();

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        const { plainText, boolean } = MediaWikiTemplate.Parsers;

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

        const template = await this.page.getTemplate(this.templateName);
        Object.assign(this, template.parse(config));
        this.parseCosts();

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
