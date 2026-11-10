import { createSchema, type Document, type Strata } from "../../src/index.js"

type Item = Document<{ name: string; profile?: { city: string } }>
const schema = createSchema<Item>()
schema.field("name", { type: "TEXT" })
schema.field("profile.city", { type: "TEXT" })
schema.compoundIndex("valid", ["name", "profile.city"])
// @ts-expect-error unknown field names must be rejected
schema.field("naem", { type: "TEXT" })
// @ts-expect-error unknown nested paths must be rejected
schema.field("profile.ctiy", { type: "TEXT" })
// @ts-expect-error compound index field names must be checked
schema.compoundIndex("invalid", ["profile.ctiy"])
const dynamic: string = "dynamic"
// @ts-expect-error dynamic names require an explicit escape
schema.field(dynamic, { type: "TEXT" })
schema
  .fieldUnchecked(dynamic, { type: "TEXT" })
  .compoundIndexUnchecked("dynamic", [dynamic])

declare const db: Strata
const builder = db.collection<Item>("items")
builder
  .field("profile.city", { type: "TEXT" })
  .compoundIndex("valid", ["name", "profile.city"])
// @ts-expect-error builder field names must be checked
builder.field("naem", { type: "TEXT" })
// @ts-expect-error builder compound index names must be checked
builder.compoundIndex("invalid", ["profile.ctiy"])
builder
  .fieldUnchecked(dynamic, { type: "TEXT" })
  .compoundIndexUnchecked("dynamic", [dynamic])
