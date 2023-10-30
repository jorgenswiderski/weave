import { SpellStubConstructor } from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/stubs';
import {
    CompressableRecord,
    CompressableRecordHandle,
} from '@jorgenswiderski/tomekeeper-shared/dist/models/compressable-record/types';
import { RecordCompressor } from '@jorgenswiderski/tomekeeper-shared/dist/models/compressable-record/compressable-record';
import { ISpell } from '@jorgenswiderski/tomekeeper-shared/dist/types/action';
import { CHOICE_ID_NOT_SET_BY_SERVER } from './types';

let compress: (id: number, choiceId: string) => CompressableRecordHandle;

export class SpellStub implements CompressableRecord {
    id: number;

    constructor(public spell: ISpell) {
        this.id = spell.id;
    }

    toJSON(): CompressableRecordHandle {
        return compress(this.id, CHOICE_ID_NOT_SET_BY_SERVER);
    }
}

// Assure that the constructor signature matches that defined by the class stub
// See stubs.ts for more info
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const typeCheck: SpellStubConstructor = SpellStub;

compress = RecordCompressor.registerClass(SpellStub, 1);
