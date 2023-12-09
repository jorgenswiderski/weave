import { IAction } from '@jorgenswiderski/tomekeeper-shared/dist/types/action';
import { AbilityScore } from '@jorgenswiderski/tomekeeper-shared/dist/types/ability';
import { PageNotFoundError } from '../errors';
import { MediaWikiTemplate } from '../media-wiki/media-wiki-template';
import { ActionBase } from './action-base';
import { MediaWikiTemplateParserConfig } from '../media-wiki/types';

export class Action extends ActionBase implements Partial<IAction> {
    condition2?: string;
    condition2Duration?: number;
    condition2Save?: AbilityScore;

    constructor(pageTitle: string, template: string = 'ActionPage') {
        super(pageTitle, template);
    }

    protected async initData(): Promise<void> {
        await super.initData();

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        const { plainText, int } = MediaWikiTemplate.Parsers;
        const { parseEnum } = MediaWikiTemplate.HighOrderParsers;

        const config: MediaWikiTemplateParserConfig = {
            condition2: {
                key: 'condition2',
                parser: plainText,
                default: undefined,
            },
            condition2Duration: {
                key: 'condition2 duration',
                parser: int,
                default: undefined,
            },
            condition2Save: {
                key: 'condition2 save',
                parser: parseEnum(AbilityScore),
                default: undefined,
            },
        };

        const template = await this.page.getTemplate(this.templateName);
        Object.assign(this, template.parse(config));
    }

    toJSON(): Partial<IAction> {
        const result: Partial<IAction> = super.toJSON();

        const keys: Array<keyof IAction> = [
            'condition2',
            'condition2Duration',
            'condition2Save',
        ];

        keys.forEach((key) => {
            if (key in this) {
                result[key] = this[key] as any;
            }
        });

        return result;
    }
}
