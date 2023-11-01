import {
    EquipmentItemType,
    ItemRarity,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/equipment-item';
import { MwnApiClass } from '../../api/mwn';
import { MediaWiki } from '../media-wiki';
import { EquipmentItem } from './equipment-item';
import { WeaponItem } from './weapon-item';
import { ImageCacheService } from '../image-cache-service';

let itemData: Record<string, EquipmentItem[]> | null = null;
let itemDataById: Map<number, EquipmentItem> | null = null;

export async function getEquipmentItemData(
    types?: EquipmentItemType[],
): Promise<Record<string, EquipmentItem[]>> {
    if (!itemData) {
        const categories = [
            'Equipment',
            'Clothing',
            'Light Armour',
            'Medium Armour',
            'Heavy Armour',
            'Shields',
            'Helmets',
            'Cloaks',
            'Gloves',
            'Boots',
            'Amulets',
            'Rings',
        ];

        const equipmentItemNames = await Promise.all(
            categories.map((category) =>
                MwnApiClass.queryTitlesFromCategory(category),
            ),
        );
        const uniqueNames = [...new Set(equipmentItemNames.flat())];
        const pages = await Promise.all(uniqueNames.map(MediaWiki.getPage));

        const weaponNames = pages
            .filter((page) => page?.content?.includes('{{WeaponPage'))
            .map((page) => page!.title);
        const armourNames = pages
            .filter((page) => page?.content?.includes('{{EquipmentPage'))
            .map((page) => page!.title);

        const data = [
            ...armourNames.map((name) => new EquipmentItem(name)),
            ...weaponNames.map((name) => new WeaponItem(name)),
        ];
        await Promise.all(data.map((item) => item.waitForInitialization()));

        const filtered = data.filter(
            (item) =>
                (item?.rarity && item?.rarity > ItemRarity.common) ||
                item.baseArmorClass ||
                item instanceof WeaponItem,
        );

        filtered.forEach(
            (item) => item.image && ImageCacheService.cacheImage(item.image),
        );

        itemData = filtered.reduce(
            (acc, item) => {
                if (item.type) {
                    if (!acc[item.type]) {
                        acc[item.type] = [];
                    }

                    acc[item.type].push(item);
                }

                return acc;
            },
            {} as Record<string, EquipmentItem[]>,
        );

        itemDataById = new Map<number, EquipmentItem>();
        filtered.forEach((item) => itemDataById!.set(item.id!, item));
    }

    if (!types) {
        return itemData;
    }

    const filteredData: Record<string, EquipmentItem[]> = {};

    types.forEach((type) => {
        if (itemData![type]) {
            filteredData[type] = itemData![type];
        }
    });

    return filteredData;
}

export async function getEquipmentItemInfoById() {
    if (!itemDataById) {
        await getEquipmentItemData();
    }

    return itemDataById!;
}
