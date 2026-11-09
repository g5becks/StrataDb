import { expect, test } from "bun:test"
import { createSchema, type Document, Strata } from "../../src/index.js"

type Item = Document<{ text: string }>

for (const indexed of [false, true]) {
  test(`A13 [TASK-238] exact matching, escaped search and patterns indexed=${indexed}`, async () => {
    using db = new Strata({ database: ":memory:", enableCache: true })
    const items = db.collection(
      "items",
      createSchema<Item>().field("text", { type: "TEXT", indexed }).build()
    )
    await items.insertMany([
      { _id: "mixed", text: "Alice" },
      { _id: "upper", text: "ALICE" },
      { _id: "lower", text: "alice" },
      { _id: "underscore", text: "_literal" },
      { _id: "percent", text: "50% off" },
      { _id: "slash", text: "C:\\files\\one" },
      { _id: "glob", text: "[*?]" },
      { _id: "unicode", text: "Äpfel" },
      { _id: "unicodeLower", text: "äpfel" },
      { _id: "blank", text: "" },
    ])
    const cases = [
      { operator: "$like", value: "ALICE", ids: ["upper"] },
      { operator: "$like", value: "A_ice", ids: ["mixed"] },
      { operator: "$like", value: "a%", ids: ["lower"] },
      { operator: "$like", value: "[*?]", ids: ["glob"] },
      { operator: "$like", value: "\\_literal", ids: ["underscore"] },
      { operator: "$ilike", value: "ALICE", ids: ["lower", "mixed", "upper"] },
      { operator: "$ilike", value: "a%", ids: ["lower", "mixed", "upper"] },
      { operator: "$ilike", value: "ä%", ids: ["unicodeLower"] },
      { operator: "$contains", value: "%", ids: ["percent"] },
      { operator: "$contains", value: "_", ids: ["underscore"] },
      { operator: "$contains", value: "\\", ids: ["slash"] },
      { operator: "$contains", value: "Alice", ids: ["mixed"] },
      { operator: "$startsWith", value: "_", ids: ["underscore"] },
      { operator: "$startsWith", value: "C:\\", ids: ["slash"] },
      { operator: "$endsWith", value: "\\one", ids: ["slash"] },
      { operator: "$endsWith", value: "ICE", ids: ["upper"] },
    ]
    for (let pass = 0; pass < 2; pass += 1) {
      for (const { operator, value, ids } of cases) {
        expect(
          (await items.find({ text: { [operator]: value } } as never))
            .map((item) => item._id)
            .sort()
        ).toEqual(ids)
      }
    }
    for (const operator of ["$contains", "$startsWith", "$endsWith"]) {
      expect(await items.count({ text: { [operator]: "" } } as never)).toBe(10)
    }
    for (const caseSensitive of [false, true]) {
      for (const [text, id] of [
        ["%", "percent"],
        ["_", "underscore"],
        ["\\", "slash"],
      ]) {
        expect(
          (await items.search(text, ["text"], { caseSensitive })).map(
            (item) => item._id
          )
        ).toEqual([id])
      }
    }
    expect(
      (await items.search("ALICE", ["text"], { caseSensitive: true })).map(
        (item) => item._id
      )
    ).toEqual(["upper"])
    expect(
      (await items.search("ALICE", ["text"])).map((item) => item._id).sort()
    ).toEqual(["lower", "mixed", "upper"])
    // An external SQLite LIKE pragma does not change the explicit API semantics.
    db.sqliteDb.exec("PRAGMA case_sensitive_like = ON")
    expect(await items.count({ text: { $ilike: "ALICE" } })).toBe(3)
  })
}
