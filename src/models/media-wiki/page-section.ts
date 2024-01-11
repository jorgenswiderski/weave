import { IPageSection } from './types';

export class PageSection implements IPageSection {
    constructor(
        public title: string,
        public content: string,
    ) {}

    static getSections(
        content: string,
        nameOrRegex: string,
        depth?: number,
        allowInlineSection: boolean = false,
    ): PageSection[] {
        const eqs = depth ? '='.repeat(depth) : '={2,}';

        const regex = new RegExp(
            `(?<=\\n${
                allowInlineSection ? '?' : ''
            }\\s*|^)(${eqs})\\s*(${nameOrRegex})\\s*\\1\\s*\\n([\\s\\S]+?)(?=\\n\\s*\\1[^=]|$)`,
            'ig',
        );

        const matches = content.matchAll(regex);

        return [...matches].map(
            ([, , title, sectionContent]) =>
                new PageSection(title.trim(), sectionContent),
        );
    }

    getSubsections(
        nameOrRegex: string,
        depth?: number,
        allowInlineSection?: boolean,
    ): PageSection[] {
        return PageSection.getSections(
            this.content,
            nameOrRegex,
            depth,
            allowInlineSection,
        );
    }

    getSubsection(
        nameOrRegex: string,
        depth?: number,
        allowInlineSection?: boolean,
    ): PageSection | null {
        return (
            PageSection.getSections(
                this.content,
                nameOrRegex,
                depth,
                allowInlineSection,
            )?.[0] || null
        );
    }
}
