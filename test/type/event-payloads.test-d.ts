import { expectTypeOf } from "expect-type"
import type { DeleteEvent, Document, UpdateEvent } from "../../src/index.js"

type Item = Document<{ name: string }>
declare const update: UpdateEvent<Item>
if (!update.upserted) {
  expectTypeOf(update.document).toEqualTypeOf<Item>()
}
declare const deletion: DeleteEvent<Item>
if (deletion.deleted) {
  expectTypeOf(deletion._id).toEqualTypeOf<string>()
} else {
  expectTypeOf(deletion._id).toEqualTypeOf<null>()
}
