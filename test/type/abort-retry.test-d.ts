import { expectTypeOf } from "expect-type"
import type {
  AbortedError,
  Collection,
  Document,
  RetryContext,
  RetryOptions,
  StrataDBError,
} from "../../src/index.js"

// ============================================================================
// TEST TYPES
// ============================================================================

type TestDoc = Document<{
  name: string
  value: number
}>

// Mock collection for testing
declare const collection: Collection<TestDoc>

// ============================================================================
// RetryOptions Type Structure
// ============================================================================

// RetryOptions should accept all valid properties
expectTypeOf({
  retries: 3,
} satisfies RetryOptions).toMatchTypeOf<RetryOptions>()

expectTypeOf({
  retries: 3,
  minTimeout: 100,
} satisfies RetryOptions).toMatchTypeOf<RetryOptions>()

expectTypeOf({
  retries: 3,
  minTimeout: 100,
  maxRetryTime: 5000,
} satisfies RetryOptions).toMatchTypeOf<RetryOptions>()

expectTypeOf({
  retries: 3,
  onFailedAttempt: (context: RetryContext) => {
    expectTypeOf(context.attemptNumber).toEqualTypeOf<number>()
    expectTypeOf(context.retriesLeft).toEqualTypeOf<number>()
    expectTypeOf(context.error).toEqualTypeOf<Error>()
  },
} satisfies RetryOptions).toMatchTypeOf<RetryOptions>()

expectTypeOf({
  retries: 3,
  shouldRetry: (_context: RetryContext) => true,
} satisfies RetryOptions).toMatchTypeOf<RetryOptions>()

expectTypeOf({
  retries: 3,
  shouldConsumeRetry: (_context: RetryContext) => true,
} satisfies RetryOptions).toMatchTypeOf<RetryOptions>()

// RetryContext should have correct structure
expectTypeOf({
  attemptNumber: 1,
  retriesLeft: 2,
  retriesConsumed: 0,
  error: new Error("test"),
} satisfies RetryContext).toMatchTypeOf<RetryContext>()

// ============================================================================
// AbortedError Type
// ============================================================================

// AbortedError should extend StrataDBError
declare const abortedError: AbortedError
expectTypeOf(
  abortedError satisfies StrataDBError
).toMatchTypeOf<StrataDBError>()

// AbortedError should have correct properties
expectTypeOf(abortedError.message).toEqualTypeOf<string>()
expectTypeOf(abortedError.code).toEqualTypeOf<string>()
expectTypeOf(abortedError.category).toEqualTypeOf<"database">()
expectTypeOf(abortedError.reason).toEqualTypeOf<unknown>()

// ============================================================================
// Signal Option on Collection Methods
// ============================================================================

// Read operations
expectTypeOf(
  collection.find(
    {},
    { signal: new AbortController().signal }
  ) satisfies Promise<readonly TestDoc[]>
).toMatchTypeOf<Promise<readonly TestDoc[]>>()

expectTypeOf(
  collection.findOne(
    {},
    { signal: new AbortController().signal }
  ) satisfies Promise<TestDoc | null>
).toMatchTypeOf<Promise<TestDoc | null>>()

expectTypeOf(
  collection.findById("id", {
    signal: new AbortController().signal,
  }) satisfies Promise<TestDoc | null>
).toMatchTypeOf<Promise<TestDoc | null>>()

expectTypeOf(
  collection.count(
    {},
    { signal: new AbortController().signal }
  ) satisfies Promise<number>
).toMatchTypeOf<Promise<number>>()

expectTypeOf(
  collection.search("query", ["name"], {
    signal: new AbortController().signal,
  }) satisfies Promise<readonly TestDoc[]>
).toMatchTypeOf<Promise<readonly TestDoc[]>>()

expectTypeOf(
  collection.distinct(
    "name",
    {},
    { signal: new AbortController().signal }
  ) satisfies Promise<unknown[]>
).toMatchTypeOf<Promise<unknown[]>>()

expectTypeOf(
  collection.estimatedDocumentCount({
    signal: new AbortController().signal,
  }) satisfies Promise<number>
).toMatchTypeOf<Promise<number>>()

// Write operations
expectTypeOf(
  collection.insertOne(
    { name: "test", value: 1 },
    { signal: new AbortController().signal }
  ) satisfies Promise<TestDoc>
).toMatchTypeOf<Promise<TestDoc>>()

expectTypeOf(
  collection.replaceOne(
    "id",
    { name: "test", value: 1 },
    { signal: new AbortController().signal }
  ) satisfies Promise<TestDoc | null>
).toMatchTypeOf<Promise<TestDoc | null>>()

expectTypeOf(
  collection.deleteOne("id", {
    signal: new AbortController().signal,
  }) satisfies Promise<boolean>
).toMatchTypeOf<Promise<boolean>>()

// Atomic operations
expectTypeOf(
  collection.findOneAndDelete(
    {},
    { signal: new AbortController().signal }
  ) satisfies Promise<TestDoc | null>
).toMatchTypeOf<Promise<TestDoc | null>>()

expectTypeOf(
  collection.findOneAndUpdate(
    {},
    { value: 2 },
    { signal: new AbortController().signal }
  ) satisfies Promise<TestDoc | null>
).toMatchTypeOf<Promise<TestDoc | null>>()

expectTypeOf(
  collection.findOneAndReplace(
    {},
    { name: "test", value: 2 },
    { signal: new AbortController().signal }
  ) satisfies Promise<TestDoc | null>
).toMatchTypeOf<Promise<TestDoc | null>>()

// Utility operations
expectTypeOf(
  collection.drop({
    signal: new AbortController().signal,
  }) satisfies Promise<void>
).toMatchTypeOf<Promise<void>>()

expectTypeOf(
  collection.validate(
    { name: "test", value: 1 },
    { signal: new AbortController().signal }
  ) satisfies Promise<TestDoc>
).toMatchTypeOf<Promise<TestDoc>>()

// ============================================================================
// Retry Option on Collection Methods
// ============================================================================

// Read operations with retry
expectTypeOf(
  collection.find({}, { retry: { retries: 3 } }) satisfies Promise<
    readonly TestDoc[]
  >
).toMatchTypeOf<Promise<readonly TestDoc[]>>()

expectTypeOf(
  collection.findOne(
    {},
    { retry: { retries: 3, minTimeout: 100 } }
  ) satisfies Promise<TestDoc | null>
).toMatchTypeOf<Promise<TestDoc | null>>()

expectTypeOf(
  collection.findById("id", {
    retry: { retries: 3 },
  }) satisfies Promise<TestDoc | null>
).toMatchTypeOf<Promise<TestDoc | null>>()

expectTypeOf(
  collection.count({}, { retry: { retries: 3 } }) satisfies Promise<number>
).toMatchTypeOf<Promise<number>>()

expectTypeOf(
  collection.search("query", ["name"], {
    retry: { retries: 3 },
  }) satisfies Promise<readonly TestDoc[]>
).toMatchTypeOf<Promise<readonly TestDoc[]>>()

expectTypeOf(
  collection.distinct("name", {}, { retry: { retries: 3 } }) satisfies Promise<
    unknown[]
  >
).toMatchTypeOf<Promise<unknown[]>>()

expectTypeOf(
  collection.estimatedDocumentCount({
    retry: { retries: 3 },
  }) satisfies Promise<number>
).toMatchTypeOf<Promise<number>>()

// Write operations with retry
expectTypeOf(
  collection.insertOne(
    { name: "test", value: 1 },
    { retry: { retries: 3 } }
  ) satisfies Promise<TestDoc>
).toMatchTypeOf<Promise<TestDoc>>()

expectTypeOf(
  collection.replaceOne(
    "id",
    { name: "test", value: 1 },
    { retry: { retries: 3 } }
  ) satisfies Promise<TestDoc | null>
).toMatchTypeOf<Promise<TestDoc | null>>()

expectTypeOf(
  collection.deleteOne("id", {
    retry: { retries: 3 },
  }) satisfies Promise<boolean>
).toMatchTypeOf<Promise<boolean>>()

// Atomic operations with retry
expectTypeOf(
  collection.findOneAndDelete(
    {},
    { retry: { retries: 3 } }
  ) satisfies Promise<TestDoc | null>
).toMatchTypeOf<Promise<TestDoc | null>>()

expectTypeOf(
  collection.findOneAndUpdate(
    {},
    { value: 2 },
    { retry: { retries: 3 } }
  ) satisfies Promise<TestDoc | null>
).toMatchTypeOf<Promise<TestDoc | null>>()

expectTypeOf(
  collection.findOneAndReplace(
    {},
    { name: "test", value: 2 },
    { retry: { retries: 3 } }
  ) satisfies Promise<TestDoc | null>
).toMatchTypeOf<Promise<TestDoc | null>>()

// Utility operations with retry
expectTypeOf(
  collection.drop({ retry: { retries: 3 } }) satisfies Promise<void>
).toMatchTypeOf<Promise<void>>()

expectTypeOf(
  collection.validate(
    { name: "test", value: 1 },
    { retry: { retries: 3 } }
  ) satisfies Promise<TestDoc>
).toMatchTypeOf<Promise<TestDoc>>()

// ============================================================================
// Retry: false Option
// ============================================================================

// retry: false should be accepted
expectTypeOf(
  collection.find({}, { retry: false }) satisfies Promise<readonly TestDoc[]>
).toMatchTypeOf<Promise<readonly TestDoc[]>>()

expectTypeOf(
  collection.insertOne(
    { name: "test", value: 1 },
    { retry: false }
  ) satisfies Promise<TestDoc>
).toMatchTypeOf<Promise<TestDoc>>()

expectTypeOf(
  collection.findOneAndUpdate(
    {},
    { value: 2 },
    { retry: false }
  ) satisfies Promise<TestDoc | null>
).toMatchTypeOf<Promise<TestDoc | null>>()

expectTypeOf(
  collection.drop({ retry: false }) satisfies Promise<void>
).toMatchTypeOf<Promise<void>>()

// ============================================================================
// Combined Signal and Retry Options
// ============================================================================

// Both signal and retry should work together
expectTypeOf(
  collection.find(
    {},
    {
      signal: new AbortController().signal,
      retry: { retries: 3, minTimeout: 100 },
    }
  ) satisfies Promise<readonly TestDoc[]>
).toMatchTypeOf<Promise<readonly TestDoc[]>>()

expectTypeOf(
  collection.insertOne(
    { name: "test", value: 1 },
    {
      signal: new AbortController().signal,
      retry: { retries: 3 },
    }
  ) satisfies Promise<TestDoc>
).toMatchTypeOf<Promise<TestDoc>>()

expectTypeOf(
  collection.findOneAndUpdate(
    {},
    { value: 2 },
    {
      signal: new AbortController().signal,
      retry: false,
    }
  ) satisfies Promise<TestDoc | null>
).toMatchTypeOf<Promise<TestDoc | null>>()

// ============================================================================
// Invalid Retry Options Should Error
// ============================================================================

// Invalid retry properties should error
// @ts-expect-error - invalid value must be rejected
expectTypeOf({ retries: "3" } satisfies RetryOptions)

// @ts-expect-error - invalid value must be rejected
expectTypeOf({ retries: 3, minTimeout: "100" } satisfies RetryOptions)

// @ts-expect-error - invalid value must be rejected
expectTypeOf({ retries: 3, invalidProperty: true } satisfies RetryOptions)
