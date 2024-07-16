import { MediaWikiTemplate } from './media-wiki-template';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { Parsers, HighOrderParsers } = MediaWikiTemplate;

describe('MediaWikiTemplate', () => {
    describe('parse', () => {
        it('should parse a template with only named parameters', () => {
            const wikitext = `{{Infobox
| name = Test
| desc = This is a description.
| age = 20
}}`;

            const template = new MediaWikiTemplate(wikitext);

            const result = template.parse({
                name: {},
                desc: {},
                age: { parser: Parsers.int },
            });

            expect(result).toEqual({
                name: 'Test',
                desc: 'This is a description.',
                age: 20,
            });
        });

        it('should parse a template with only unnamed parameters', () => {
            const wikitext = `{{Infobox
| Test
| This is a description.
| 20
}}`;

            const template = new MediaWikiTemplate(wikitext);

            const result = template.parse({
                name: { key: 1 },
                desc: { key: 2 },
                age: { key: 3, parser: Parsers.int },
            });

            expect(result).toEqual({
                name: 'Test',
                desc: 'This is a description.',
                age: 20,
            });
        });

        it('should parse a template with both named and unnamed parameters', () => {
            const wikitext = `{{Infobox
| This is a description.
| 20
| image = Test.png
}}`;

            const template = new MediaWikiTemplate(wikitext);

            const result = template.parse({
                desc: { key: 1 },
                age: { key: 2, parser: Parsers.int },
                image: {},
            });

            expect(result).toEqual({
                desc: 'This is a description.',
                age: 20,
                image: 'Test.png',
            });
        });

        it('should parse a template without line breaks', () => {
            const wikitext = `{{Infobox|name=Test|desc=This is a description.|age=20}}`;

            const template = new MediaWikiTemplate(wikitext);

            const result = template.parse({
                name: {},
                desc: {},
                age: { parser: Parsers.int },
            });

            expect(result).toEqual({
                name: 'Test',
                desc: 'This is a description.',
                age: 20,
            });
        });

        //         it('should parse a template with mixed line breaks', () => {
        //             const wikitext = `{{Infobox| name = Test
        // | desc = This is a description. | age = 20
        // }}`;

        //             const template = new MediaWikiTemplate(wikitext);

        //             const result = template.parse({
        //                 name: {},
        //                 desc: {},
        //                 age: { parser: Parsers.int },
        //             });

        //             expect(result).toEqual({
        //                 name: 'Test',
        //                 desc: 'This is a description.',
        //                 age: 20,
        //             });
        //         });

        it('should parse a template with inconsistent spacing', () => {
            const wikitext = `{{Infobox
    | name=Test
|desc = This is a description.
| age=20
}}`;

            const template = new MediaWikiTemplate(wikitext);

            const result = template.parse({
                name: {},
                desc: {},
                age: { parser: Parsers.int },
            });

            expect(result).toEqual({
                name: 'Test',
                desc: 'This is a description.',
                age: 20,
            });
        });
    });
});
