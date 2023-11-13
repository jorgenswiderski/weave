/* eslint-disable max-classes-per-file */

import assert from 'assert';
import {
    IGameLocation,
    IGameLocationNode,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/game-location';
import { ItemSourceLocation } from '@jorgenswiderski/tomekeeper-shared/dist/types/item-sources';
import { PageNotFoundError } from '../errors';
import { warn } from '../logger';
import { MediaWiki } from '../media-wiki';

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

        this.name = name;
        this.id = id;
        this.depth = depth ?? parent.depth + 1;
        parent.addChild(this);
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
}

const gameLocationRoot = new GameLocationRoot();
export const gameLocationById = new Map<number, GameLocation>();
export const gameLocationByPageTitle = new Map<string, GameLocation>();

export async function initLocations() {
    const data = await MediaWiki.getPage('List of locations');

    if (!data?.content) {
        throw new PageNotFoundError();
    }

    const { content } = data;

    const lines = content.split('\n').map((line) => line.trim());

    const filtered = lines.filter(
        (line) => line.length > 0 && line.match(/^[*=]+/),
    );

    const locations: { depth: number; name: string; id?: number }[] =
        await Promise.all(
            filtered.map(async (line) => {
                const match = line.match(/^[*=]+/)!;
                const prefix = match[0];

                let depth = prefix.length;

                if (prefix.charAt(0) === '*') {
                    depth += 3;
                } else {
                    depth -= 1;
                }

                const nameMatch = line.match(/\[\[([^|\]]+).*?]]/);

                if (!nameMatch) {
                    assert(!line.includes('[['));

                    return { depth, name: line.match(/([\w\s-]+)/)![0].trim() };
                }

                const pageTitle = nameMatch[1];

                try {
                    const page = await MediaWiki.getPage(pageTitle);

                    if (!page) {
                        throw new PageNotFoundError();
                    }

                    return { depth, name: page.title, id: page.pageId };
                } catch (err) {
                    warn(`Could not find page for location '${pageTitle}'`);

                    return { depth, name: pageTitle };
                }
            }),
        );

    const path: GameLocationNode[] = [gameLocationRoot];

    locations.forEach(({ depth, name, id }) => {
        let loc: GameLocation;

        if (depth > path.length) {
            warn(`Location '${name}' has no valid parent.`);

            // eslint-disable-next-line no-new
            loc = new GameLocation(path[path.length - 1], { name, id }, depth);
        } else {
            loc = new GameLocation(path[depth - 1], { name, id });
            path[depth] = loc;
        }

        if (id) {
            gameLocationById.set(id, loc);
        }

        gameLocationByPageTitle.set(name, loc);

        path.splice(depth + 1);
    });

    return filtered;
}
