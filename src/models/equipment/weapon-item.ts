import { IActionEffect } from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import {
    IWeaponItem,
    WeaponCategory,
    WeaponHandedness,
    WeaponRange,
    WeaponRangeType,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/equipment-item';
import { DamageType } from '@jorgenswiderski/tomekeeper-shared/dist/types/damage';
import { PageNotFoundError } from '../errors';
import { MediaWikiTemplate } from '../media-wiki/media-wiki-template';
import { EquipmentItem } from './equipment-item';
import { MediaWikiTemplateParserConfig } from '../media-wiki/types';

export class WeaponItem extends EquipmentItem implements Partial<IWeaponItem> {
    category?: WeaponCategory;
    rangeType?: WeaponRangeType;
    handedness?: WeaponHandedness;
    damage?: string;
    damageType?: DamageType;
    damageVersatile?: string;
    extraDamage?: string;
    extraDamage2?: string;
    range?: WeaponRange;
    finesse?: boolean;
    heavy?: boolean;
    light?: boolean;
    reach?: boolean;
    thrown?: boolean;
    cantDualWield?: boolean;
    dippable?: boolean;
    weaponActions?: IActionEffect[];
    special?: IActionEffect[];

    constructor(public name: string) {
        super(name, 'WeaponPage');
    }

    protected async initData(): Promise<void> {
        await super.initData();

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        if (!(await this.page.hasTemplate(['WeaponPage', 'EquipmentPage']))) {
            return;
        }

        const { plainText, boolean } = MediaWikiTemplate.Parsers;
        const { parseEnum } = MediaWikiTemplate.HighOrderParsers;

        const config: MediaWikiTemplateParserConfig = {
            category: {
                parser: parseEnum(WeaponCategory),
            },
            rangeType: {
                parser: parseEnum(WeaponRangeType),
                default: WeaponRangeType.melee,
            },
            handedness: {
                parser: parseEnum(WeaponHandedness),
            },
            damage: { parser: plainText },
            damageType: { key: 'damage type', parser: parseEnum(DamageType) },
            damageVersatile: {
                key: 'versatile damage',
                parser: plainText,
                default: undefined,
            },
            extraDamage: {
                key: 'extra damage',
                parser: plainText,
                default: undefined,
            },
            extraDamage2: {
                key: 'extra damage 2',
                parser: plainText,
                default: undefined,
            },
            range: {
                parser: parseEnum(WeaponRange),
                default: WeaponRange.melee,
            },
            finesse: { parser: boolean, default: false },
            heavy: { parser: boolean, default: false },
            light: { parser: boolean, default: false },
            reach: { parser: boolean, default: false },
            thrown: { parser: boolean, default: false },
            cantDualWield: { parser: boolean, default: false },
            dippable: { parser: boolean, default: false },
            // weaponActions: {
            //     parser: plainText, // This might need a custom parser.
            //     default: [],
            // },
            // special: {
            //     parser: plainText, // This might need a custom parser.
            //     default: [],
            // },
        };

        // Rarely, a item page could have multiple templates for variations of the item
        // Just grab the first variant
        const template = (await this.page.getTemplates(this.templateName))[0];
        Object.assign(this, template.parse(config));
    }

    toJSON() {
        const data = super.toJSON();

        return {
            ...data,
            category: this.category,
            rangeType: this.rangeType,
            handedness: this.handedness,
            damage: this.damage,
            damageType: this.damageType,
            damageVersatile: this.damageVersatile,
            extraDamage: this.extraDamage,
            extraDamage2: this.extraDamage2,
            range: this.range,
            finesse: this.finesse,
            heavy: this.heavy,
            light: this.light,
            reach: this.reach,
            thrown: this.thrown,
            cantDualWield: this.cantDualWield,
            dippable: this.dippable,
            weaponActions: this.weaponActions,
            special: this.special,
        };
    }
}
