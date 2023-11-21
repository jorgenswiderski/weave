import { SpellEffectStubConstructor } from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/stubs';
import { ISpell } from '@jorgenswiderski/tomekeeper-shared/dist/types/action';
import { StaticReference } from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/static-reference';
import {
    StaticReferenceHandle,
    StaticReferenceIdentifier,
    StaticallyReferenceable,
} from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/types';

let ref: {
    pool: Map<number, SpellStub>;
    create: (id: number) => StaticReferenceHandle;
};

export class SpellStub implements StaticallyReferenceable {
    id: number;

    constructor(public spell: ISpell) {
        this.id = spell.id;
    }

    toJSON(): StaticReferenceHandle {
        return ref.create(this.id);
    }
}

// Assure that the constructor signature matches that defined by the class stub
// See stubs.ts for more info
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const typeCheck: SpellEffectStubConstructor = SpellStub;

ref = StaticReference.registerClass(SpellStub, StaticReferenceIdentifier.Spell);
