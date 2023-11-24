import { StaticReference } from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/static-reference';
import { CharacteristicStubConstructor } from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/stubs';
import {
    StaticReferenceHandle,
    StaticReferenceIdentifier,
} from '@jorgenswiderski/tomekeeper-shared/dist/models/static-reference/types';
import { ICharacteristic } from '@jorgenswiderski/tomekeeper-shared/dist/types/grantable-effect';

let ref: {
    pool: Map<number, CharacteristicStub>;
    create: (id: number) => StaticReferenceHandle;
};

export class CharacteristicStub implements StaticReference {
    id: number;
    image?: string;
    name: string;

    constructor(public characteristic: ICharacteristic) {
        this.id = characteristic.id;
        this.image = characteristic.image;
        this.name = characteristic.name;
    }

    toJSON(): StaticReferenceHandle {
        return ref.create(this.id);
    }
}

// Assure that the constructor signature matches that defined by the class stub
// See stubs.ts for more info
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const typeCheck: CharacteristicStubConstructor = CharacteristicStub;

ref = StaticReference.registerClass(
    CharacteristicStub,
    StaticReferenceIdentifier.Characteristic,
);
