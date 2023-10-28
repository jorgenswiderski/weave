import { IAction } from 'planner-types/src/types/action';
import { ActionStubConstructor } from 'planner-types/src/models/static-reference/stubs';
import {
    CompressableRecord,
    CompressableRecordHandle,
} from 'planner-types/src/models/compressable-record/types';
import { RecordCompressor } from 'planner-types/src/models/compressable-record/compressable-record';
import { CHOICE_ID_NOT_SET_BY_SERVER } from './types';

let compress: (id: number, choiceId: string) => CompressableRecordHandle;

export class ActionStub implements CompressableRecord {
    id: number;

    constructor(public action: IAction) {
        this.id = action.id;
    }

    toJSON(): CompressableRecordHandle {
        return compress(this.id, CHOICE_ID_NOT_SET_BY_SERVER);
    }
}

// Assure that the constructor signature matches that defined by the class stub
// See stubs.ts for more info
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const typeCheck: ActionStubConstructor = ActionStub;

compress = RecordCompressor.registerClass(ActionStub, 2);
