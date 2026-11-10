import { expect, test } from "bun:test"
import fc from "fast-check"
import { createSchema, type Document, Strata } from "../../src/index.js"
import { type Filter, matches } from "./reference-query.js"

type Item = Document<{
  n?: number | null
  s?: string | null
  inner?: { n?: number | null; s?: string | null }
  flag?: boolean | null
  nums?: (number | null)[] | null
  items?: { qty: number; sku?: string | null }[] | null
}>
const number = fc.integer({ min: -3, max: 3 })
const text = fc.constantFrom(
  "",
  "a",
  "A",
  "a'b",
  "%",
  "_",
  "\\",
  "[]*?",
  "é",
  "Ä",
  "a\nb"
)
const nullableNumber = fc.oneof(number, fc.constant(null))
const nullableText = fc.oneof(text, fc.constant(null))
const optionalNumber = fc.oneof(nullableNumber, fc.constant(undefined))
const optionalText = fc.oneof(nullableText, fc.constant(undefined))
const pattern = fc
  .array(
    fc.constantFrom(
      "a",
      "A",
      "é",
      "%",
      "_",
      "\\%",
      "\\_",
      "\\\\",
      "[",
      "]",
      "*",
      "?"
    ),
    { maxLength: 5 }
  )
  .map((pieces) => pieces.join(""))
const document = fc.record({
  n: optionalNumber,
  s: optionalText,
  flag: fc.constantFrom(true, false, null, undefined),
  inner: fc.oneof(
    fc.record({ n: optionalNumber, s: optionalText }),
    fc.constant(undefined)
  ),
  nums: fc.oneof(
    fc.array(nullableNumber, { maxLength: 5 }),
    fc.constant(null),
    fc.constant(undefined)
  ),
  items: fc.oneof(
    fc.array(fc.record({ qty: number, sku: optionalText }), { maxLength: 4 }),
    fc.constant(null),
    fc.constant(undefined)
  ),
})

function field(name: string, op: string, operand: unknown): Filter {
  return { [name]: { [op]: operand } }
}

const numberCondition = fc.oneof(
  nullableNumber,
  fc
    .tuple(
      fc.constantFrom("$eq", "$ne", "$gt", "$gte", "$lt", "$lte"),
      nullableNumber
    )
    .map(([op, value]) => ({ [op]: value })),
  fc.boolean().map((value) => ({ $exists: value }))
)
const numeric = fc
  .tuple(
    fc.constantFrom("n", "inner.n"),
    fc.constantFrom("$eq", "$ne", "$gt", "$gte", "$lt", "$lte"),
    nullableNumber
  )
  .map(([name, op, value]) => field(name, op, value))
const membership = fc.oneof(
  fc
    .tuple(
      fc.constantFrom("n", "inner.n"),
      fc.constantFrom("$in", "$nin"),
      fc.array(nullableNumber, { maxLength: 4 })
    )
    .map(([name, op, values]) => field(name, op, values)),
  fc
    .tuple(
      fc.constantFrom("s", "inner.s"),
      fc.constantFrom("$in", "$nin"),
      fc.array(nullableText, { maxLength: 4 })
    )
    .map(([name, op, values]) => field(name, op, values))
)
const stringFilter = fc.oneof(
  fc
    .tuple(
      fc.constantFrom("s", "inner.s"),
      fc.constantFrom("$like", "$ilike"),
      pattern
    )
    .map(([name, op, value]) => field(name, op, value)),
  fc
    .tuple(
      fc.constantFrom("s", "inner.s"),
      fc.constantFrom("$contains", "$startsWith", "$endsWith", "$eq", "$ne"),
      text
    )
    .map(([name, op, value]) => field(name, op, value))
)
const arrays = fc.oneof(
  fc
    .array(nullableNumber, { maxLength: 3 })
    .map((values) => field("nums", "$all", values)),
  fc.integer({ min: 0, max: 5 }).map((value) => field("nums", "$size", value)),
  fc
    .tuple(fc.integer({ min: 0, max: 5 }), numberCondition)
    .map(([index, condition]) => field("nums", "$index", { index, condition })),
  numberCondition.map((condition) =>
    field(
      "nums",
      "$elemMatch",
      typeof condition === "object" && condition !== null
        ? condition
        : { $eq: condition }
    )
  ),
  fc
    .tuple(number, nullableText)
    .map(([qty, sku]) =>
      field("items", "$elemMatch", { qty: { $gte: qty }, sku })
    )
)
const exists = fc
  .tuple(
    fc.constantFrom(
      "n",
      "s",
      "inner.n",
      "inner.s",
      "nums",
      "items",
      "flag",
      "_id"
    ),
    fc.boolean()
  )
  .map(([name, value]) => field(name, "$exists", value))
const boolean = fc
  .tuple(fc.constantFrom("$eq", "$ne"), fc.constantFrom(true, false, null))
  .map(([op, value]) => field("flag", op, value))
const base = fc.oneof(
  numeric,
  membership,
  stringFilter,
  arrays,
  exists,
  boolean,
  nullableNumber.map((value) => ({ n: value }))
)

function filters(depth: number): fc.Arbitrary<Filter> {
  if (!depth) {
    return base
  }
  const child = filters(depth - 1)
  return fc.oneof(
    base,
    base,
    fc
      .tuple(
        fc.constantFrom("$and", "$or", "$nor"),
        fc.array(child, { maxLength: 3 })
      )
      .map(([op, values]) => ({ [op]: values })),
    child.map((value) => ({ $not: value }))
  )
}

function shifted(value: unknown): unknown {
  if (typeof value === "number") {
    return value + 1
  }
  if (typeof value === "string") {
    return `${value}a`
  }
  if (typeof value === "boolean") {
    return !value
  }
  if (Array.isArray(value)) {
    return value.map(shifted)
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, shifted(item)])
    )
  }
  return value
}

test("[TASK-251] 500 differential query cases against independent semantics", async () => {
  const seed =
    process.env.STRATADB_PROPERTY_RANDOM === "1"
      ? (crypto.getRandomValues(new Int32Array(1))[0] ?? 20_261_110)
      : Number(process.env.STRATADB_PROPERTY_SEED ?? "20261110")
  console.info(
    `StrataDB property seed=${seed}; replay: STRATADB_PROPERTY_SEED=${seed} bun test test/property/query-differential.test.ts`
  )
  let completed = 0
  await fc.assert(
    fc.asyncProperty(
      fc.array(document, { maxLength: 12 }),
      filters(2),
      fc.boolean(),
      fc.boolean(),
      async (input, filter, indexed, enableCache) => {
        using db = new Strata({ database: ":memory:", enableCache })
        const schema = createSchema<Item>()
          .field("n", { type: "REAL", indexed })
          .field("s", { type: "TEXT", indexed })
          .field("inner.n", { type: "REAL", indexed })
          .field("inner.s", { type: "TEXT", indexed })
          .field("flag", { type: "BOOLEAN", indexed })
          .field("nums", { type: "BLOB", indexed })
          .field("items", { type: "BLOB", indexed })
          .build()
        const items = db.collection("items", schema)
        const records = JSON.parse(
          JSON.stringify(
            input.map((item, index) => ({
              ...item,
              _id: `doc-${String(index).padStart(2, "0")}`,
            }))
          )
        ) as Record<string, unknown>[]
        await items.insertMany(records as never)
        for (const query of [filter, filter, shifted(filter) as Filter]) {
          const expected = records
            .filter((item) => matches(item, query))
            .map((item) => item._id)
            .sort()
          expect(
            (await items.find(query as never, { sort: { _id: 1 } })).map(
              (item) => item._id
            )
          ).toEqual(expected)
        }
        completed += 1
      }
    ),
    { seed, numRuns: 500 }
  )
  expect(completed).toBe(500)
})
