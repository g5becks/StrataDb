import { expectTypeOf } from "expect-type"
import type {
  Document,
  QueryFilter,
  RawChangeEvent,
  StringOperator,
} from "../../src/index.js"

expectTypeOf({
  $regex: "^\\p{L}+$",
} satisfies StringOperator).toMatchTypeOf<StringOperator>()
expectTypeOf({ name: { $regex: "^hello" } } satisfies QueryFilter<
  Document<{ name: string }>
>).toMatchTypeOf<QueryFilter<Document<{ name: string }>>>()
// @ts-expect-error regex operands must be strings
expectTypeOf({ $regex: 3 } satisfies StringOperator)
// @ts-expect-error RegExp objects are not supported operands
expectTypeOf({ $regex: /x/u } satisfies StringOperator)
declare const event: RawChangeEvent
expectTypeOf(event.rowid).toEqualTypeOf<number | bigint>()
expectTypeOf(event.operation).toEqualTypeOf<"insert" | "update" | "delete">()
