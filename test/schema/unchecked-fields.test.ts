import { expect, test } from "bun:test"
import {
  createSchema,
  type Document,
  QueryError,
  Strata,
} from "../../src/index.js"

type Item = Document<{ name: string }>
test("[TASK-247] unchecked schema and builder fields retain runtime path validation", async () => {
  using db = new Strata({ database: ":memory:" })
  const dynamic: string = "extra"
  const schema = createSchema<Item>()
    .fieldUnchecked(dynamic, { type: "TEXT", indexed: true })
    .compoundIndexUnchecked("dynamic", [dynamic])
    .build()
  const items = db.collection("items", schema)
  await items.insertOne({ name: "a", extra: "value" } as never)
  expect(await items.count({ extra: "value" } as never)).toBe(1)
  const built = db
    .collection<Item>("built")
    .fieldUnchecked(dynamic, { type: "TEXT", indexed: true })
    .compoundIndexUnchecked("dynamic", [dynamic])
    .build()
  await built.insertOne({ name: "b", extra: "value" } as never)
  expect(await built.count({ extra: "value" } as never)).toBe(1)
  expect(() =>
    db.collection(
      "invalid",
      createSchema<Item>()
        .fieldUnchecked("bad');--", { type: "TEXT", indexed: true })
        .build()
    )
  ).toThrow(QueryError)
})
