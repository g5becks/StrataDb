import { expectTypeOf } from "expect-type"
import type { ArrayOperator, Document, QueryFilter } from "../../src/index.js"

type Item = Document<{
  nums: number[]
  tags: string[]
  rows: { qty: number; nested: { name: string } }[]
  matrix: number[][]
}>
const numeric = { $index: { index: 0, condition: { $gte: 2 } } }
expectTypeOf(numeric satisfies ArrayOperator<number[]>).toMatchTypeOf<
  ArrayOperator<number[]>
>()
const text = { $index: { index: 1, condition: "admin" } }
expectTypeOf(text satisfies ArrayOperator<string[]>).toMatchTypeOf<
  ArrayOperator<string[]>
>()
const elements = {
  nums: { $elemMatch: { $gt: 1, $lt: 5 } },
  tags: { $elemMatch: { $regex: "^a", $contains: "x" } },
  rows: {
    $elemMatch: { qty: { $gte: 2 }, "nested.name": { $startsWith: "a" } },
  },
  matrix: { $elemMatch: { $all: [1], $size: 2 } },
}
expectTypeOf(elements satisfies QueryFilter<Item>).toMatchTypeOf<
  QueryFilter<Item>
>()
const shorthand = { $index: 0 }
// @ts-expect-error numeric index shorthand is unsupported by the runtime
expectTypeOf(shorthand satisfies ArrayOperator<number[]>)
const missingCondition = { $index: { index: 0 } }
// @ts-expect-error index objects require a condition
expectTypeOf(missingCondition satisfies ArrayOperator<number[]>)
const wrongIndex = { $index: { index: "zero", condition: 1 } }
// @ts-expect-error index must be numeric
expectTypeOf(wrongIndex satisfies ArrayOperator<number[]>)
const wrongCondition = { $index: { index: 0, condition: "text" } }
// @ts-expect-error condition operands follow the array element type
expectTypeOf(wrongCondition satisfies ArrayOperator<number[]>)
const wrongNumber = { $elemMatch: { $gt: "text" } }
// @ts-expect-error numeric element operators require numeric operands
expectTypeOf(wrongNumber satisfies ArrayOperator<number[]>)
const wrongText = { $elemMatch: { $contains: 2 } }
// @ts-expect-error string element operators require string operands
expectTypeOf(wrongText satisfies ArrayOperator<string[]>)
const wrongObject = { rows: { $elemMatch: { qty: { $gt: "text" } } } }
// @ts-expect-error object element fields keep their operand types
expectTypeOf(wrongObject satisfies QueryFilter<Item>)
