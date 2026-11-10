import type { AtomicUpdate, Collection, Document } from "../../src/index.js"

type Item = Document<{
  name: string
  count: number
  nested?: { n: number }
  tags: string[]
}>
declare const items: Collection<Item>
const update: AtomicUpdate<Item> = {
  $inc: { count: 1 },
  $set: { "nested.n": 2 },
  $push: { tags: "a" },
}
items.updateOne("id", update)
items.updateMany({}, { $pull: { tags: "a" } })
items.findOneAndUpdate("id", { $unset: { nested: true } })
items.updateOne("id", { nested: { n: 2 } })
// @ts-expect-error operator and plain updates cannot mix
items.updateOne("id", { name: "x", $inc: { count: 1 } })
// @ts-expect-error increment requires a numeric operand
items.updateOne("id", { $inc: { count: "one" } })
// @ts-expect-error increment only accepts numeric paths
items.updateOne("id", { $inc: { name: 1 } })
// @ts-expect-error push only accepts array paths
items.updateOne("id", { $push: { count: 1 } })
// @ts-expect-error set values must match the selected path
items.updateOne("id", { $set: { "nested.n": "wrong" } })
// @ts-expect-error metadata is immutable
items.updateOne("id", { $set: { _id: "changed" } })
