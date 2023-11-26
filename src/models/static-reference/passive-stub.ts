import { StaticReference } from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/static-reference';
import { PassiveStubConstructor } from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/stubs';
import {
    StaticReferenceHandle,
    StaticReferenceIdentifier,
} from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/types';
import { IPassive } from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';

let ref: {
    pool: Map<number, PassiveStub>;
    create: (id: number) => StaticReferenceHandle;
};

export class PassiveStub implements StaticReference {
    id: number;
    image?: string;
    name: string;

    constructor(public passive: IPassive) {
        this.id = passive.id;
        this.image = passive.image;
        this.name = passive.name;
    }

    toJSON(): StaticReferenceHandle {
        return ref.create(this.id);
    }
}

// Assure that the constructor signature matches that defined by the class stub
// See stubs.ts for more info
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const typeCheck: PassiveStubConstructor = PassiveStub;

ref = StaticReference.registerClass(
    PassiveStub,
    StaticReferenceIdentifier.Passive,
);
