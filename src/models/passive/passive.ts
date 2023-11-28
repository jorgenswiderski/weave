import {
    PassiveType,
    GrantableEffect,
    GrantableEffectType,
    IPassive,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';
import assert from 'assert';
import { PageItem, PageLoadingState } from '../page-item';
import { error, warn } from '../logger';
import { PageNotFoundError } from '../errors';
import { MediaWikiTemplate } from '../media-wiki/media-wiki-template';
import { MediaWikiTemplateParserConfig } from '../media-wiki/types';
import { StaticImageCacheService } from '../static-image-cache-service';
import { MediaWiki } from '../media-wiki/media-wiki';

enum PassiveLoadState {
    PASSIVE_DATA = 'PASSIVE_DATA',
}

export class Passive extends PageItem implements Partial<IPassive> {
    name?: string;
    description?: string;
    image?: string;
    type: GrantableEffectType.PASSIVE = GrantableEffectType.PASSIVE;
    id?: number;

    // unused
    hidden?: boolean;
    grants?: GrantableEffect[];
    subtype?: PassiveType;
    values?: any;

    used: boolean = false;

    constructor(pageTitle: string) {
        super({ pageTitle });

        this.initialized[PassiveLoadState.PASSIVE_DATA] =
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
            if (!(await this.page.hasTemplate(['Action Page', 'SpellPage']))) {
                warn(
                    `Passive page '${this.page.title}' is missing Passive feature page template!`,
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

    toJSON(): Partial<IPassive> {
        const result: Partial<IPassive> = {};

        const keys: Array<keyof IPassive> = [
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

let passiveData: Passive[];
let passiveDataById: Map<number, Passive> | null = null;

export async function initPassives(): Promise<void> {
    const passiveNames = await MediaWiki.getTitlesInCategories([
        'Passive features',
    ]);

    passiveData = passiveNames.map((name) => new Passive(name));
    await Promise.all(passiveData.map((p) => p.waitForInitialization()));
    passiveData = passiveData.filter((p) => p.id);
    passiveDataById = new Map<number, Passive>();

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

export function getPassiveDataFiltered(): Passive[] {
    assert(
        passiveData,
        'Passive data should be initialized before fetching it!',
    );

    return passiveData.filter((passive) => passive.used);
}

export function getPassiveDataById(): Map<number, Passive> {
    assert(
        passiveDataById,
        'Passive data should be initialized before fetching it!',
    );

    return passiveDataById;
}
