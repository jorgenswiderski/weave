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

        // Transclude Template:H3
        // TODO: Use a generalized solution for transcluding templates
        // (current transclusion code doesn't support parameters)
        const replaced = content.replace(
            /{{H3\s*\|\s*([^}]+?)\s*}}/gi,
            `===$1===`,
        );

        const regex = new RegExp(
            `(?<=\\n${
                allowInlineSection ? '?' : ''
            }\\s*|^)(${eqs})\\s*(${nameOrRegex})\\s*\\1\\s*\\n([\\s\\S]+?)(?=\\n\\s*\\1[^=]|$)`,
            'ig',
        );

        const matches = [...replaced.matchAll(regex)];

        return matches.map(
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
