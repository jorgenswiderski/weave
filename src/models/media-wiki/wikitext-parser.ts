export class MediaWikiParser {
    static getAllPageTitles(wikitext: string): string[] {
        const pageTitleMatch = /\[\[([^#|\]]+).*?]]/g;
        const coordsTemplateMatch = /{{Coords\|-?\d+\|-?\d+\|([^}]+)}}/g;

        return [
            ...wikitext.matchAll(pageTitleMatch),
            ...wikitext.matchAll(coordsTemplateMatch),
        ].map((match) => match[1]);
    }

    static parseNameFromPageTitle(title: string) {
        return title.split('(')[0].trim();
    }

    static removeComments(wikitext: string): string {
        return wikitext.replace(/<!--[\s\S]*?-->/g, '');
    }
}
