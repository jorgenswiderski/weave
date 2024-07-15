/* eslint-disable max-classes-per-file */

import assert from 'assert';
import {
    IGameLocation,
    IGameLocationNode,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/game-location';
import { ItemSourceLocation } from '@jorgenswiderski/tomekeeper-shared/dist/types/item-sources';
import { PageNotFoundError } from '../errors';
import { MediaWiki } from '../media-wiki/media-wiki';
import { MediaWikiParser } from '../media-wiki/media-wiki-parser';
import { IPageSection } from '../media-wiki/types';
import { PageSection } from '../media-wiki/page-section';

class GameLocationNode {
    parent?: GameLocationNode;
    children: GameLocation[] = [];
    depth: number = 0;

    addChild(node: GameLocation) {
        this.children.push(node);
    }

    protected getDepth(depth: number): GameLocation | undefined {
        if (depth === this.depth) {
            return this as unknown as GameLocation;
        }

        if (this.parent && depth < this.depth) {
            return this.parent.getDepth(depth);
        }

        return undefined;
    }
}

class GameLocationRoot extends GameLocationNode {
    parent: undefined;
}

export class GameLocation
    extends GameLocationNode
    implements IGameLocationNode
{
    name: string;
    id?: number;

    constructor(
        public parent: GameLocationNode,
        { name, id }: IGameLocation,
        depth?: number,
    ) {
        super();

        this.id = id;
        this.depth = depth ?? parent.depth + 1;
        this.name = this.parseName(name);
        parent.addChild(this);
    }

    parseName(title: string): string {
        if (this.depth === 1) {
            assert(title.startsWith('Act'));

            // Map the number text (ie "One") to a numeral (ie "1"),
            // it just looks nicer, brevity, etc
            const digitMap: { [key: string]: string } = {
                One: '1',
                Two: '2',
                Three: '3',
            };

            const actNumber = title.split(' ')[1];

            return `Act ${digitMap[actNumber]}`;
        }

        return MediaWikiParser.parseNameFromPageTitle(title);
    }

    toJSON() {
        return { name: this.name, id: this.id };
    }

    getItemSourceLocation(): ItemSourceLocation {
        return {
            act: this.getDepth(1)!.toJSON(),
            superRegion: this.getDepth(2)?.toJSON(),
            region: this.getDepth(3)?.toJSON(),
            location: this.depth > 3 ? this?.toJSON() : undefined,
        };
    }

    static async fromPageTitle(
        parent: GameLocationNode,
        pageTitle: string,
    ): Promise<GameLocation> {
        let id: number | undefined;

        try {
            const page = await MediaWiki.getPage(pageTitle);
            id = page.pageId;
        } catch (err) {
            // do nothing
        }

        return new GameLocation(parent, { name: pageTitle, id });
    }
}

const gameLocationRoot = new GameLocationRoot();
export const gameLocationById = new Map<number, GameLocation>();
export const gameLocationByPageTitle = new Map<string, GameLocation>();

async function parseLocation(
    parent: GameLocation,
    image: string,
    pageTitle: string,
    locationContent: string,
): Promise<void> {
    const contentLines = locationContent
        .split(/\n|(?:<br>)/)
        .map((line) => line.trim());

    // const description = contentLines[0];

    const location = await GameLocation.fromPageTitle(parent, pageTitle);

    const subLocationMatches = [
        ...contentLines
            .slice(1)
            .join('\n')
            .matchAll(/\[\[([^|]*?)(?:\[^}]*?)?]]/g),
    ];

    const subLocationNames = subLocationMatches.map((match) => match![1]);

    await Promise.all(
        subLocationNames.map((subtitle) =>
            GameLocation.fromPageTitle(location, subtitle),
        ),
    );
}

async function parseRegion(
    parent: GameLocation,
    { title, content }: IPageSection,
): Promise<void> {
    const region = await GameLocation.fromPageTitle(parent, title);

    const locationMatches = [
        ...content.matchAll(
            /{{ImageLocation\|([^|]+?)\|([^|]+?)\|([\s\S]+?)}}/g,
        ),
    ];

    await Promise.all(
        locationMatches.map(([, image, pageTitle, locationContent]) =>
            parseLocation(region, image, pageTitle, locationContent),
        ),
    );
}

async function parseSuperRegion(
    parent: GameLocation,
    { title, content }: IPageSection,
): Promise<void> {
    const superRegion = await GameLocation.fromPageTitle(parent, title);

    await Promise.all(
        PageSection.getSections(content, `[^=]+?`, 4).map((section) =>
            parseRegion(superRegion, section),
        ),
    );
}

async function parseAct({ title, content }: IPageSection): Promise<void> {
    const act = await GameLocation.fromPageTitle(gameLocationRoot, title);

    await Promise.all(
        PageSection.getSections(content, `[^=]+?`, 3).map((section) =>
            parseSuperRegion(act, section),
        ),
    );
}

export async function initLocations() {
    const data = await MediaWiki.getPage('List of locations');

    if (!data?.content) {
        throw new PageNotFoundError();
    }

    await Promise.all(data.getSections(`Act \\w+?`, 2).map(parseAct));

    function indexLocations(location: GameLocationNode): void {
        if (location instanceof GameLocation) {
            gameLocationByPageTitle.set(location.name, location);

            if (location.id) {
                gameLocationById.set(location.id, location);
            }
        }

        location.children.forEach(indexLocations);
    }

    indexLocations(gameLocationRoot);
}

export function getLocationData() {
    assert(gameLocationByPageTitle.size > 0);
    const locations = [...gameLocationByPageTitle.values()];

    return locations.sort((a, b) => {
        if (!a.id && !b.id) {
            return a.name < b.name ? -1 : 1;
        }

        if (!a.id) {
            return -1;
        }

        if (!b.id) {
            return 1;
        }

        return a.id - b.id;
    });
}
