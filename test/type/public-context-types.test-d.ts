import { expectTypeOf } from "expect-type"
import type {
  ArrayValue,
  Collection,
  CollectionAdminContract,
  CollectionBatchContract,
  CollectionEventsContract,
  CollectionOptions,
  CollectionReadContract,
  CollectionWriteContract,
  Document,
  RetryableOptions,
  SQLiteErrorContext,
  UpdatePath,
} from "../../src/index.js"

type Item = Document<{ name: string; tags: string[] }>
expectTypeOf({
  statementCacheSize: 2,
  retry: false,
} satisfies CollectionOptions).toMatchTypeOf<CollectionOptions>()
expectTypeOf({
  retries: 1,
  signal: new AbortController().signal,
} satisfies RetryableOptions).toMatchTypeOf<RetryableOptions>()
expectTypeOf({
  sql: "SELECT 1",
  collection: "items",
  operation: "find",
} satisfies SQLiteErrorContext).toMatchTypeOf<SQLiteErrorContext>()
expectTypeOf<ArrayValue<readonly string[] | null>>().toEqualTypeOf<string>()
expectTypeOf<ArrayValue<number>>().toEqualTypeOf<never>()
expectTypeOf("name" as const satisfies UpdatePath<Item>).toMatchTypeOf<
  UpdatePath<Item>
>()
// @ts-expect-error metadata cannot be an atomic update path
expectTypeOf("_id" satisfies UpdatePath<Item>)
expectTypeOf<Collection<Item>>().toMatchTypeOf<CollectionReadContract<Item>>()
expectTypeOf<Collection<Item>>().toMatchTypeOf<CollectionWriteContract<Item>>()
expectTypeOf<Collection<Item>>().toMatchTypeOf<CollectionBatchContract<Item>>()
expectTypeOf<Collection<Item>>().toMatchTypeOf<CollectionEventsContract<Item>>()
expectTypeOf<Collection<Item>>().toMatchTypeOf<CollectionAdminContract<Item>>()
