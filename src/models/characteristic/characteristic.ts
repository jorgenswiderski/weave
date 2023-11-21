import {
    CharacteristicType,
    GrantableEffect,
    GrantableEffectType,
    ICharacteristic,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import assert from 'assert';
import { PageItem, PageLoadingState } from '../page-item';
import { error, warn } from '../logger';
import { PageNotFoundError } from '../errors';
import { MediaWikiTemplate } from '../media-wiki/media-wiki-template';
import { MediaWikiTemplateParserConfig } from '../media-wiki/types';
import { StaticImageCacheService } from '../static-image-cache-service';
import { MediaWiki } from '../media-wiki/media-wiki';

enum CharacteristicLoadState {
    CHARACTERISTIC_DATA = 'CHARACTERISTIC_DATA',
}

export class Characteristic
    extends PageItem
    implements Partial<ICharacteristic>
{
    name?: string;
    description?: string;
    image?: string;
    type: GrantableEffectType.CHARACTERISTIC =
        GrantableEffectType.CHARACTERISTIC;
    id?: number;

    // unused
    hidden?: boolean;
    grants?: GrantableEffect[];
    subtype?: CharacteristicType;
    values?: any;

    used: boolean = false;

    constructor(pageTitle: string) {
        super({ pageTitle });

        this.initialized[CharacteristicLoadState.CHARACTERISTIC_DATA] =
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

    protected async initData(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        if (!(await this.page.hasTemplate('Passive feature page'))) {
            // If its an Action Page, no problem, it'll just be picked up by the Actions code
            if (!(await this.page.hasTemplate(['Action Page', 'Spell Page']))) {
                warn(
                    `Characteristic page '${this.page.title}' is missing Passive feature page template!`,
                );
            }

            return;
        }

        this.id = this.page.pageId;

        const { noOp, plainText } = MediaWikiTemplate.Parsers;

        const config: MediaWikiTemplateParserConfig = {
            name: { parser: plainText, default: this.pageTitle },
            image: {
                parser: noOp,
                default: undefined,
            },
            description: {
                parser: plainText,
                default: undefined,
            },
        };

        const template = await this.page.getTemplate('Passive feature page');
        Object.assign(this, template.parse(config));
    }

    toJSON(): Partial<ICharacteristic> {
        const result: Partial<ICharacteristic> = {};

        const keys: Array<keyof ICharacteristic> = [
            'name',
            'description',
            'image',
            'type',
            'id',
        ];

        keys.forEach((key) => {
            if (key in this) {
                result[key] = this[key] as any;
            }
        });

        return result;
    }

    markUsed(): void {
        if (this.image) {
            StaticImageCacheService.cacheImage(this.image);
        }

        this.used = true;
    }
}

let passiveData: Characteristic[];
let passiveDataById: Map<number, Characteristic> | null = null;

export async function initPassives(): Promise<void> {
    const passiveNames = await MediaWiki.getTitlesInCategories([
        'Passive features',
    ]);

    passiveData = passiveNames.map((name) => new Characteristic(name));
    await Promise.all(passiveData.map((p) => p.waitForInitialization()));
    passiveData = passiveData.filter((p) => p.id);
    passiveDataById = new Map<number, Characteristic>();

    passiveData.forEach((passive) => {
        if (passiveDataById!.has(passive.id!)) {
            const other = passiveDataById!.get(passive.id!)!;

            error(
                `Spell data conflict between ${other.pageTitle} (${other.id}) and ${passive.pageTitle} (${passive.id})`,
            );
        }

        passiveDataById!.set(passive.id!, passive);
    });
}

export function getPassiveDataFiltered(): Characteristic[] {
    assert(
        passiveData,
        'Passive data should be initialized before fetching it!',
    );

    return passiveData.filter((passive) => passive.used);
}

export function getPassiveDataById(): Map<number, Characteristic> {
    assert(
        passiveDataById,
        'Passive data should be initialized before fetching it!',
    );

    return passiveDataById;
}
