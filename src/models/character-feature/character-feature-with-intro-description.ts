import { MediaWiki } from '../media-wiki/media-wiki';
import { CharacterFeature } from './character-feature';

export class CharacterFeatureWithIntroDescription extends CharacterFeature {
    async initDescription(): Promise<void> {
        if (!this.pageTitle) {
            throw new Error('failed to init description without page title');
        }

        const data = await MediaWiki.getTextExtract(this.pageTitle, {
            intro: true,
        });

        this.description = data ? data.split('\n')[0].trim() : '<ERROR>';
    }
}
