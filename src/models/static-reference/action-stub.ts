import { IAction } from '@jorgenswiderski/tomekeeper-shared/dist/types/action';
import { StaticReference } from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/static-reference';
import { StaticReferenceHandle } from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/types';
import { ActionEffectStubConstructor } from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/stubs';

let ref: {
    pool: Map<number, ActionStub>;
    create: (id: number) => StaticReferenceHandle;
};

export class ActionStub implements StaticReference {
    id: number;

    constructor(public action: IAction) {
        this.id = action.id;
    }

    toJSON(): StaticReferenceHandle {
        return ref.create(this.id);
    }
}

// Assure that the constructor signature matches that defined by the class stub
// See stubs.ts for more info
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const typeCheck: ActionEffectStubConstructor = ActionStub;

ref = StaticReference.registerClass(ActionStub, 'a');
