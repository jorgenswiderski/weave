export class MediaWikiParser {
    static getAllPageTitles(content: string): string[] {
        const pageTitleMatch = /\[\[([^#|\]]+).*?]]/g;
        const coordsTemplateMatch = /{{Coords\|-?\d+\|-?\d+\|([^}]+)}}/g;

        return [
            ...content.matchAll(pageTitleMatch),
            ...content.matchAll(coordsTemplateMatch),
        ].map((match) => match[1]);
    }

    static parseNameFromPageTitle(title: string) {
        return title.split('(')[0].trim();
    }
}
