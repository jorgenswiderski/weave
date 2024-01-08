import { MediaWikiParser } from './media-wiki-parser';

describe('MediaWikiParser', () => {
    describe('parseWikiTable', () => {
        it('should parse a simple table into an array of records', () => {
            const wikitext = `{| class="wikitable"
! Header1
! Header2
|-
| Cell1
| Cell2
|-
| Cell3
| Cell4
|}`;

            const result = MediaWikiParser.parseWikiTable(wikitext);

            expect(result).toEqual([
                { Header1: 'Cell1', Header2: 'Cell2' },
                { Header1: 'Cell3', Header2: 'Cell4' },
            ]);
        });

        it('should parse a simple table into a 2d array', () => {
            const wikitext = `{| class="wikitable"
! Header1
! Header2
|-
| Cell1
| Cell2
|-
| Cell3
| Cell4
|}`;

            const result = MediaWikiParser.parseWikiTable(wikitext, '2d');

            expect(result).toEqual([
                ['Cell1', 'Cell2'],
                ['Cell3', 'Cell4'],
            ]);
        });

        it('should handle empty cells correctly', () => {
            const wikitext = `{| class="wikitable"
! Header1
! Header2
|-
| Cell1
| Cell2
|-
| Cell3
|
|}`;

            const result = MediaWikiParser.parseWikiTable(wikitext);

            const expected = [
                { Header1: 'Cell1', Header2: 'Cell2' },
                { Header1: 'Cell3', Header2: '' },
            ];

            expect(result).toEqual(expected);
        });

        it('should handle a cell that spans multiple rows', () => {
            const wikitext = `{| class="wikitable nomobile" style="width: 100%;"
|-
! colspan="2" | Class Progression
|-
! style="width: 6%;" | Level
! style="width: 8%;" | Proficiency Bonus
|-
| 1st
| rowspan="3" style="text-align: center;" | +2
|-
| rowspan="3" style="text-align: center;" | 2nd
|-
|-
| +3
|}`;

            const result = MediaWikiParser.parseWikiTable(wikitext);

            const expected = [
                {
                    Level: '1st',
                    'Proficiency Bonus': '+2',
                },
                {
                    Level: '2nd',
                    'Proficiency Bonus': '+2',
                },
                {
                    Level: '2nd',
                    'Proficiency Bonus': '+2',
                },
                {
                    Level: '2nd',
                    'Proficiency Bonus': '+3',
                },
            ];

            expect(result).toEqual(expected);
        });

        it('should be able to parse a martial class progression table', () => {
            const wikitext = `{| class="wikitable" style="width: 100%;"
|-
! colspan="3" |  The Fighter Class Progression
|-
! style="width: 6%;" | Level
! style="width: 6%;" | [[Proficiency Bonus]]
! Features
|-
| [[#Level 1|1st]]
| rowspan="4" style="text-align: center;" | +2
| {{SAI|Second Wind}}, [[Fighting Style]]
|-
| [[#Level 2|2nd]]
| {{SAI|Action Surge}}
|-
| [[#Level 3|3rd]]
| {{Icon|Fighter_Class_Icon.png|24|link=#Level 3}} [[#Level 3|Choose a subclass]]
|-
| [[#Level 4|4th]]
| {{SAI|Feats|Feat}}
|-
| [[#Level 5|5th]]
| style="text-align: center;" | +3
| {{SAI|Extra Attack}}
|}`;

            const result = MediaWikiParser.parseWikiTable(wikitext);

            const expected = [
                {
                    Level: '[[#Level 1|1st]]',
                    'Proficiency Bonus': '+2',
                    Features: '{{SAI|Second Wind}}, [[Fighting Style]]',
                },
                {
                    Level: '[[#Level 2|2nd]]',
                    'Proficiency Bonus': '+2',
                    Features: '{{SAI|Action Surge}}',
                },
                {
                    Level: '[[#Level 3|3rd]]',
                    'Proficiency Bonus': '+2',
                    Features:
                        '{{Icon|Fighter_Class_Icon.png|24|link=#Level 3}} [[#Level 3|Choose a subclass]]',
                },
                {
                    Level: '[[#Level 4|4th]]',
                    'Proficiency Bonus': '+2',
                    Features: '{{SAI|Feats|Feat}}',
                },
                {
                    Level: '[[#Level 5|5th]]',
                    'Proficiency Bonus': '+3',
                    Features: '{{SAI|Extra Attack}}',
                },
            ];

            expect(result).toEqual(expected);
        });

        it('should be able to parse a caster class progression table', () => {
            const wikitext = `{| class="wikitable nomobile" style="width: 100%;"
|-
! colspan="6" | The Wizard Class Progression
! colspan="6" | [[Spells#Spell Slots|Spell Slots]] per [[Spells#Spell Level|Spell Level]]
|-
! style="width: 6%;" | Level
! style="width: 8%;" | [[Proficiency Bonus]]
! Features
! style="width: 14%;" | {{R|arcrec}}
! style="width: 8%;" | Spells Learned
! style="width: 6%;" | Cantrips Known
! style="width: 3%;" | 1st
! style="width: 3%;" | 2nd
! style="width: 3%;" | 3rd
! style="width: 3%;" | 4th
! style="width: 3%;" | 5th
! style="width: 3%;" | 6th
|-
| [[Wizard#Level 1|1st]]
| rowspan="4" style="text-align: center;" | +2
| {{Icon|Class Wizard Hotbar Icon.png|24|link=#Level 1}} [[Wizard#Spellcasting|Spellcasting]], {{SAI|Arcane Recovery}}
| rowspan="2" style="text-align: center;" | 1
| style="text-align: center;" | 6
| rowspan="3" style="text-align: center;" | 3
| 2
| -
| -
| -
| -
| -
|-
| [[Wizard#Level 2|2nd]]
| {{Icon|Class Wizard Hotbar Icon.png|24|link=#Level 2}} [[Wizard#Level 2|Choose a subclass]]
| style="text-align: center;" | 8
| 3
| -
| -
| -
| -
| -
|-
| [[Wizard#Level 3|3rd]]
| -
| rowspan="2" style="text-align: center;" | 2
| style="text-align: center;" | 10
| 4
| 2
| -
| -
| -
| -
|-
| [[Wizard#Level 4|4th]]
| {{SAI|Feats|Feat}}
| style="text-align: center;" | 12
| rowspan="6" style="text-align: center;" | 4
| 4
| 3
| -
| -
| -
| -
|-
| [[Wizard#Level 5|5th]]
| rowspan="4" style="text-align: center;" | +3
| -
| rowspan="2" style="text-align: center;" | 3
| style="text-align: center;" | 14
| 4
| 3
| 2
| -
| -
| -
|}`;

            const result = MediaWikiParser.parseWikiTable(wikitext);

            const expected = [
                {
                    Level: '[[Wizard#Level 1|1st]]',
                    'Proficiency Bonus': '+2',
                    Features:
                        '{{Icon|Class Wizard Hotbar Icon.png|24|link=#Level 1}} [[Wizard#Spellcasting|Spellcasting]], {{SAI|Arcane Recovery}}',
                    arcrec: '1',
                    'Spells Learned': '6',
                    'Cantrips Known': '3',
                    '1st': '2',
                    '2nd': '-',
                    '3rd': '-',
                    '4th': '-',
                    '5th': '-',
                    '6th': '-',
                },
                {
                    Level: '[[Wizard#Level 2|2nd]]',
                    'Proficiency Bonus': '+2',
                    Features:
                        '{{Icon|Class Wizard Hotbar Icon.png|24|link=#Level 2}} [[Wizard#Level 2|Choose a subclass]]',
                    arcrec: '1',
                    'Spells Learned': '8',
                    'Cantrips Known': '3',
                    '1st': '3',
                    '2nd': '-',
                    '3rd': '-',
                    '4th': '-',
                    '5th': '-',
                    '6th': '-',
                },
                {
                    Level: '[[Wizard#Level 3|3rd]]',
                    'Proficiency Bonus': '+2',
                    Features: '-',
                    arcrec: '2',
                    'Spells Learned': '10',
                    'Cantrips Known': '3',
                    '1st': '4',
                    '2nd': '2',
                    '3rd': '-',
                    '4th': '-',
                    '5th': '-',
                    '6th': '-',
                },
                {
                    Level: '[[Wizard#Level 4|4th]]',
                    'Proficiency Bonus': '+2',
                    Features: '{{SAI|Feats|Feat}}',
                    arcrec: '2',
                    'Spells Learned': '12',
                    'Cantrips Known': '4',
                    '1st': '4',
                    '2nd': '3',
                    '3rd': '-',
                    '4th': '-',
                    '5th': '-',
                    '6th': '-',
                },
                {
                    Level: '[[Wizard#Level 5|5th]]',
                    'Proficiency Bonus': '+3',
                    Features: '-',
                    arcrec: '3',
                    'Spells Learned': '14',
                    'Cantrips Known': '4',
                    '1st': '4',
                    '2nd': '3',
                    '3rd': '2',
                    '4th': '-',
                    '5th': '-',
                    '6th': '-',
                },
            ];

            expect(result).toEqual(expected);
        });

        it('should be able to parse a table with multiple consecutive spanned cells', () => {
            const wikitext = `{| class="wikitable nomobile" style="width: 100%;"
|-
! colspan="6" | The Monk Class Progression
|-
! style="width: 4%;" | Level
! style="width: 8%;" | [[Proficiency Bonus]]
! style="width: 4%;" |  Martial Arts
! style="width: 4%;" |  {{R|ki|forceplural=yes}}
! style="width: 11%;" |  Unarmoured Movement
! Features
|-
| [[#Level 1|1st]]
| rowspan="4" style="text-align: center;" | +2
| rowspan="2" style="text-align: center;" | 1d4
| 2
| -
| {{SAI|Unarmoured Defence (Monk)|Unarmoured Defence}}, {{SAI|Martial Arts: Dextrous Attacks}}, {{SAI|Martial Arts: Deft Strikes}}, {{SAI|Martial Arts: Bonus Unarmed Strike}}, {{SAI|Flurry of Blows}}            
|-
| [[#Level 2|2nd]]
| 3
| rowspan="4" style="text-align: center;" | + 3 m / 10 ft
|  {{SAI|Unarmoured Movement|size=25}}, {{SAI|Patient Defence}}, {{SAI|Step of the Wind: Dash}}, {{SAI|Step of the Wind: Disengage}}
|}`;

            const result = MediaWikiParser.parseWikiTable(wikitext);

            expect(result).toEqual([
                {
                    Level: '[[#Level 1|1st]]',
                    'Proficiency Bonus': '+2',
                    'Martial Arts': '1d4',
                    'ki|forceplural=yes': '2',
                    'Unarmoured Movement': '-',
                    Features:
                        '{{SAI|Unarmoured Defence (Monk)|Unarmoured Defence}}, {{SAI|Martial Arts: Dextrous Attacks}}, {{SAI|Martial Arts: Deft Strikes}}, {{SAI|Martial Arts: Bonus Unarmed Strike}}, {{SAI|Flurry of Blows}}',
                },
                {
                    Level: '[[#Level 2|2nd]]',
                    'Proficiency Bonus': '+2',
                    'Martial Arts': '1d4',
                    'ki|forceplural=yes': '3',
                    'Unarmoured Movement': '+ 3 m / 10 ft',
                    Features:
                        '{{SAI|Unarmoured Movement|size=25}}, {{SAI|Patient Defence}}, {{SAI|Step of the Wind: Dash}}, {{SAI|Step of the Wind: Disengage}}',
                },
            ]);
        });
    });
});
