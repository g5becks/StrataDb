import { expectTypeOf } from "expect-type"
import type {
  ArrayOperator,
  BulkWriteResult,
  ComparisonOperator,
  Document,
  DocumentInput,
  DocumentUpdate,
  FieldOperator,
  QueryFilter,
  StringOperator,
} from "../../src/index.js"

// ============================================================================
// TEST TYPES
// ============================================================================

/**
 * Basic user document type for testing.
 * Represents a simple user with required fields and optional nested data.
 */
type User = Document<{
  name: string
  email: string
  age: number
  active: boolean
  tags: string[]
  profile?: {
    bio: string
    settings: {
      theme: "light" | "dark"
      notifications: boolean
    }
  }
  createdAt: Date
}>

/**
 * Product document type for testing nested objects and arrays.
 * Used to verify complex nested path type extraction.
 */
type Product = Document<{
  name: string
  price: number
  inventory: {
    stock: number
    warehouse: string
  }
  categories: string[]
  variants: Array<{
    id: string
    price: number
    features: string[]
  }>
}>

// Use Product type in a test to avoid unused error
declare const _productFilter: QueryFilter<Product>
expectTypeOf(_productFilter).toEqualTypeOf<QueryFilter<Product>>()

// ============================================================================
// DOCUMENTINPUT TYPE TESTS
// ============================================================================

/**
 * DocumentInput should make the '_id' field optional while requiring all other fields.
 * This tests that input types correctly enforce required fields for insertion.
 */

// ✅ Valid DocumentInput usage - _id is optional, all other fields required
declare const validUserInput: DocumentInput<User>
expectTypeOf(validUserInput._id).toEqualTypeOf<string | undefined>()
expectTypeOf(validUserInput.name).toEqualTypeOf<string>()
expectTypeOf(validUserInput.email).toEqualTypeOf<string>()
expectTypeOf(validUserInput.age).toEqualTypeOf<number>()
expectTypeOf(validUserInput.active).toEqualTypeOf<boolean>()

// ✅ Value assignability tests
expectTypeOf({
  name: "Alice",
  email: "alice@example.com",
  age: 30,
  active: true,
  tags: ["developer"],
  createdAt: new Date(),
} as const satisfies DocumentInput<User>).toMatchTypeOf<DocumentInput<User>>()

// ✅ Valid DocumentInput usage - _id can be explicitly provided
expectTypeOf({
  _id: "user-123",
  name: "Bob",
  email: "bob@example.com",
  age: 25,
  active: true,
  tags: ["designer"],
  profile: {
    bio: "UI/UX Designer",
    settings: {
      theme: "dark",
      notifications: true,
    },
  },
  createdAt: new Date(),
} as const satisfies DocumentInput<User>).toMatchTypeOf<DocumentInput<User>>()

// ❌ Invalid DocumentInput usage - missing required fields should cause compilation error
// @ts-expect-error - invalid value must be rejected
expectTypeOf({ _id: "user-123" } satisfies DocumentInput<User>)

// ============================================================================
// DOCUMENTUPDATE TYPE TESTS
// ============================================================================

/**
 * DocumentUpdate should make all fields optional (deep partial) and exclude '_id'.
 * This tests that update types correctly allow partial updates while preventing ID modification.
 */

// ✅ Valid DocumentUpdate usage - all fields optional
declare const validUpdate: DocumentUpdate<User>
expectTypeOf(validUpdate.name).toEqualTypeOf<string | undefined>()
expectTypeOf(validUpdate.age).toEqualTypeOf<number | undefined>()

// ✅ Value assignability for partial updates
expectTypeOf({
  name: "Alice Smith",
  age: 31,
} satisfies DocumentUpdate<User>).toMatchTypeOf<DocumentUpdate<User>>()

expectTypeOf({
  profile: {
    bio: "Updated bio",
  },
} satisfies DocumentUpdate<User>).toMatchTypeOf<DocumentUpdate<User>>()

expectTypeOf({} satisfies DocumentUpdate<User>).toMatchTypeOf<
  DocumentUpdate<User>
>()

// ❌ Invalid DocumentUpdate usage - _id field should be excluded from updates
// @ts-expect-error - invalid value must be rejected
expectTypeOf({ _id: "new-id", name: "Alice" } satisfies DocumentUpdate<User>)

// ============================================================================
// COMPARISON OPERATOR TYPE TESTS
// ============================================================================

/**
 * Comparison operators should reject invalid type combinations.
 * Numbers and Dates support ordering operators, strings only support basic comparisons.
 */

// ✅ Valid comparison operators for numbers - check individual properties
declare const numberOps: ComparisonOperator<number>
expectTypeOf(numberOps.$eq).toEqualTypeOf<number | undefined>()
expectTypeOf(numberOps.$ne).toEqualTypeOf<number | undefined>()
expectTypeOf(numberOps.$gt).toEqualTypeOf<number | undefined>()
expectTypeOf(numberOps.$gte).toEqualTypeOf<number | undefined>()
expectTypeOf(numberOps.$lt).toEqualTypeOf<number | undefined>()
expectTypeOf(numberOps.$lte).toEqualTypeOf<number | undefined>()
expectTypeOf(numberOps.$in).toEqualTypeOf<readonly number[] | undefined>()
expectTypeOf(numberOps.$nin).toEqualTypeOf<readonly number[] | undefined>()

// ✅ Valid comparison operators for dates
declare const dateOps: ComparisonOperator<Date>
expectTypeOf(dateOps.$eq).toEqualTypeOf<Date | undefined>()
expectTypeOf(dateOps.$gt).toEqualTypeOf<Date | undefined>()
expectTypeOf(dateOps.$in).toEqualTypeOf<readonly Date[] | undefined>()

// ✅ Valid comparison operators for strings (no ordering operators)
declare const stringOps: ComparisonOperator<string>
expectTypeOf(stringOps.$eq).toEqualTypeOf<string | undefined>()
expectTypeOf(stringOps.$ne).toEqualTypeOf<string | undefined>()
expectTypeOf(stringOps.$in).toEqualTypeOf<readonly string[] | undefined>()

// ✅ Valid comparison operators for booleans
declare const boolOps: ComparisonOperator<boolean>
expectTypeOf(boolOps.$eq).toEqualTypeOf<boolean | undefined>()
expectTypeOf(boolOps.$ne).toEqualTypeOf<boolean | undefined>()

// ❌ Invalid comparison operators - wrong array types
expectTypeOf({
  $eq: "hello",
  // @ts-expect-error - invalid value must be rejected
  $in: [1, 2, 3],
} satisfies ComparisonOperator<string>)

// ============================================================================
// STRING OPERATOR TYPE TESTS
// ============================================================================

/**
 * String operators should only be available on string fields.
 * This ensures pattern matching operators are type-constrained to appropriate fields.
 */

// ✅ Valid string operators - check individual properties
declare const strOps: StringOperator
// @ts-expect-error - regex operators are not in the current API
expectTypeOf(strOps.$regex).toBeAny()
// @ts-expect-error - regex operators are not in the current API
expectTypeOf(strOps.$options).toBeAny()
expectTypeOf(strOps.$like).toEqualTypeOf<string | undefined>()
expectTypeOf(strOps.$startsWith).toEqualTypeOf<string | undefined>()
expectTypeOf(strOps.$endsWith).toEqualTypeOf<string | undefined>()

// ✅ String operators work with string fields in FieldOperator
declare const stringFieldOps: FieldOperator<string>
// @ts-expect-error - regex operators are not in the current API
expectTypeOf(stringFieldOps.$regex).toBeAny()
expectTypeOf(stringFieldOps.$startsWith).toEqualTypeOf<string | undefined>()

// ❌ String regex pattern must be RegExp or string
// @ts-expect-error - invalid value must be rejected
expectTypeOf({ $regex: 123 } satisfies StringOperator)

// ============================================================================
// ARRAY OPERATOR TYPE TESTS
// ============================================================================

/**
 * Array operators should only be available on array fields.
 * This ensures array-specific operations are type-constrained to array types.
 */

// ✅ Valid array operators for string arrays - check individual properties
declare const strArrayOps: ArrayOperator<string[]>
expectTypeOf(strArrayOps.$all).toEqualTypeOf<readonly string[] | undefined>()
expectTypeOf(strArrayOps.$size).toEqualTypeOf<number | undefined>()
expectTypeOf(strArrayOps.$index).toEqualTypeOf<number | undefined>()

// ✅ Valid array operators for number arrays
declare const numArrayOps: ArrayOperator<number[]>
expectTypeOf(numArrayOps.$all).toEqualTypeOf<readonly number[] | undefined>()
expectTypeOf(numArrayOps.$size).toEqualTypeOf<number | undefined>()

// ✅ Array operators work with array fields in FieldOperator
declare const tagsFieldOps: FieldOperator<string[]>
expectTypeOf(tagsFieldOps.$all).toEqualTypeOf<readonly string[] | undefined>()
expectTypeOf(tagsFieldOps.$size).toEqualTypeOf<number | undefined>()

// ❌ ArrayOperator should be never for non-array types
expectTypeOf({} as ArrayOperator<string>).toEqualTypeOf<never>()
expectTypeOf({} as ArrayOperator<number>).toEqualTypeOf<never>()

// ============================================================================
// QUERY FILTER TYPE TESTS
// ============================================================================

/**
 * QueryFilter should allow field conditions and logical operators.
 */

// ✅ Valid queries with direct field matching
expectTypeOf({
  name: "Alice",
} satisfies QueryFilter<User>).toMatchTypeOf<QueryFilter<User>>()

expectTypeOf({
  age: { $gt: 18 },
} satisfies QueryFilter<User>).toMatchTypeOf<QueryFilter<User>>()

expectTypeOf({
  active: true,
} satisfies QueryFilter<User>).toMatchTypeOf<QueryFilter<User>>()

// ✅ Valid queries with logical operators
expectTypeOf({
  $and: [{ age: { $gte: 18 } }],
} satisfies QueryFilter<User>).toMatchTypeOf<QueryFilter<User>>()

expectTypeOf({
  $or: [{ name: "Alice" }, { name: "Bob" }],
} satisfies QueryFilter<User>).toMatchTypeOf<QueryFilter<User>>()

// ✅ Valid nested path queries
expectTypeOf({
  "profile.bio": "Software engineer",
} satisfies QueryFilter<User>).toMatchTypeOf<QueryFilter<User>>()

expectTypeOf({
  "profile.settings.theme": "dark",
} satisfies QueryFilter<User>).toMatchTypeOf<QueryFilter<User>>()

// ============================================================================
// INVALID QUERY TYPE TESTS
// ============================================================================

/**
 * Invalid queries should cause compilation errors.
 */

// ❌ Invalid nested paths should cause compilation error
// @ts-expect-error - invalid value must be rejected
expectTypeOf({ "profile.nonexistent": "value" } satisfies QueryFilter<User>)

// ❌ Type mismatches should cause compilation error
// @ts-expect-error - invalid value must be rejected
expectTypeOf({ age: "thirty" } satisfies QueryFilter<User>)

// ============================================================================
// BULK WRITE RESULT TYPE TESTS
// ============================================================================

/**
 * BulkWriteResult should maintain correct types for successful and failed operations.
 */

// ✅ Valid BulkWriteResult type properties
declare const bulkResult: BulkWriteResult<User>
expectTypeOf(bulkResult.insertedCount).toEqualTypeOf<number>()
expectTypeOf(bulkResult.insertedIds).toEqualTypeOf<readonly string[]>()
expectTypeOf(bulkResult.documents).toEqualTypeOf<readonly User[]>()

// ============================================================================
// TYPE SAFETY VERIFICATION TESTS
// ============================================================================

/**
 * These tests verify that the type system prevents common runtime errors
 * through compile-time type checking.
 */

// ❌ Should prevent assigning wrong types to fields
expectTypeOf({
  name: "Alice",
  email: "alice@example.com",
  // @ts-expect-error - invalid value must be rejected
  age: "thirty",
  active: true,
  tags: ["developer"],
  createdAt: new Date(),
} satisfies DocumentInput<User>)

// ❌ Should prevent type mismatches in array elements
expectTypeOf({
  name: "Alice",
  email: "alice@example.com",
  age: 30,
  active: true,
  // @ts-expect-error - invalid value must be rejected
  tags: [1, 2, 3],
  createdAt: new Date(),
} satisfies DocumentInput<User>)
