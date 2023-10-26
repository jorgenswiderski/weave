import { ISpell } from 'planner-types/src/types/action';
import {
    StaticReferenceHandle,
    StaticallyReferenceable,
} from 'planner-types/src/models/static-reference/types';
import { StaticReference } from 'planner-types/src/models/static-reference/static-reference';
import { SpellStubConstructor } from 'planner-types/src/models/static-reference/stubs';

let ref: {
    create: (id: number) => StaticReferenceHandle;
};

export class SpellStub implements StaticallyReferenceable {
    id: number;

    constructor(public action: ISpell) {
        this.id = action.id;
    }

    toJSON(): StaticReferenceHandle {
        return ref.create(this.id);
    }
}

// Assure that the constructor signature matches that defined by the class stub
// See stubs.ts for more info
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const typeCheck: SpellStubConstructor = SpellStub;

ref = StaticReference.registerClass(SpellStub, 's');
