// biome-ignore-all lint/nursery/noUnusedExpressions: Type tests intentionally use expressions to verify TypeScript errors on projected types
// biome-ignore-all lint/complexity/noVoid: Using void to suppress unused function warnings in type tests
import { expectTypeOf } from "expect-type"
import type {
  Collection,
  Document,
  OmitSpec,
  ProjectedDocument,
  QueryOptions,
  QueryOptionsBase,
  QueryOptionsWithOmit,
  QueryOptionsWithoutProjection,
  QueryOptionsWithSelect,
  SelectSpec,
} from "../../src/index.js"

// ============================================================================
// TEST TYPES
// ============================================================================

/**
 * User document type for testing projections.
 * Contains various field types to verify projection behavior.
 */
type User = Document<{
  name: string
  email: string
  password: string
  age: number
  active: boolean
  role: "admin" | "user" | "guest"
  tags: string[]
  profile: {
    bio: string
    avatar: string
  }
  createdAt: number
  updatedAt: number
}>

// ============================================================================
// SELECT SPEC TYPE TESTS
// ============================================================================

/**
 * SelectSpec should only accept valid field names from the document type.
 */

// ✅ Valid SelectSpec with known fields
expectTypeOf(["name", "email"] satisfies SelectSpec<User>).toMatchTypeOf<
  SelectSpec<User>
>()
expectTypeOf([
  "name",
  "email",
  "age",
  "active",
] satisfies SelectSpec<User>).toMatchTypeOf<SelectSpec<User>>()
expectTypeOf(["_id", "name"] satisfies SelectSpec<User>).toMatchTypeOf<
  SelectSpec<User>
>()
expectTypeOf([] satisfies SelectSpec<User>).toMatchTypeOf<SelectSpec<User>>()

// ❌ Invalid SelectSpec with unknown fields
// @ts-expect-error - invalid value must be rejected
expectTypeOf(["name", "nonexistent"] satisfies SelectSpec<User>)
// @ts-expect-error - invalid value must be rejected
expectTypeOf(["unknownField"] satisfies SelectSpec<User>)

// ============================================================================
// OMIT SPEC TYPE TESTS
// ============================================================================

/**
 * OmitSpec should only accept valid field names from the document type.
 */

// ✅ Valid OmitSpec with known fields
expectTypeOf(["password"] satisfies OmitSpec<User>).toMatchTypeOf<
  OmitSpec<User>
>()
expectTypeOf(["password", "email"] satisfies OmitSpec<User>).toMatchTypeOf<
  OmitSpec<User>
>()
expectTypeOf([] satisfies OmitSpec<User>).toMatchTypeOf<OmitSpec<User>>()

// ❌ Invalid OmitSpec with unknown fields
// @ts-expect-error - invalid value must be rejected
expectTypeOf(["password", "nonexistent"] satisfies OmitSpec<User>)
// @ts-expect-error - invalid value must be rejected
expectTypeOf(["unknownField"] satisfies OmitSpec<User>)

// ============================================================================
// QUERY OPTIONS WITH SELECT TYPE TESTS
// ============================================================================

/**
 * QueryOptionsWithSelect should enforce select array and exclude omit/projection.
 */

// ✅ Valid QueryOptionsWithSelect
declare const selectOptions1: QueryOptionsWithSelect<User, "name" | "email">
expectTypeOf(selectOptions1.select).toEqualTypeOf<
  readonly ("name" | "email")[]
>()
expectTypeOf(selectOptions1.omit).toEqualTypeOf<undefined>()
expectTypeOf(selectOptions1.projection).toEqualTypeOf<undefined>()

// ✅ Can include sort, limit, skip with select
expectTypeOf({
  select: ["name", "age"] as const,
  sort: { name: 1 },
  limit: 10,
  skip: 0,
} satisfies QueryOptionsWithSelect<User, "name" | "age">).toMatchTypeOf<
  QueryOptionsWithSelect<User, "name" | "age">
>()

// ❌ Cannot mix select with omit
expectTypeOf({
  select: ["name"] as const,
  // @ts-expect-error - invalid value must be rejected
  omit: ["password"],
} satisfies QueryOptionsWithSelect<User, "name">)

// ============================================================================
// QUERY OPTIONS WITH OMIT TYPE TESTS
// ============================================================================

/**
 * QueryOptionsWithOmit should enforce omit array and exclude select/projection.
 */

// ✅ Valid QueryOptionsWithOmit
declare const omitOptions1: QueryOptionsWithOmit<User, "password">
expectTypeOf(omitOptions1.omit).toEqualTypeOf<readonly "password"[]>()
expectTypeOf(omitOptions1.select).toEqualTypeOf<undefined>()
expectTypeOf(omitOptions1.projection).toEqualTypeOf<undefined>()

// ✅ Can include sort, limit, skip with omit
expectTypeOf({
  omit: ["password", "email"] as const,
  sort: { name: 1 },
  limit: 10,
} satisfies QueryOptionsWithOmit<User, "password" | "email">).toMatchTypeOf<
  QueryOptionsWithOmit<User, "password" | "email">
>()

// ❌ Cannot mix omit with select
expectTypeOf({
  omit: ["password"] as const,
  // @ts-expect-error - invalid value must be rejected
  select: ["name"],
} satisfies QueryOptionsWithOmit<User, "password">)

// ============================================================================
// QUERY OPTIONS WITHOUT PROJECTION TYPE TESTS
// ============================================================================

/**
 * QueryOptionsWithoutProjection should exclude all projection options.
 */

// ✅ Valid QueryOptionsWithoutProjection
declare const noProjection: QueryOptionsWithoutProjection<User>
expectTypeOf(noProjection.select).toEqualTypeOf<undefined>()
expectTypeOf(noProjection.omit).toEqualTypeOf<undefined>()
expectTypeOf(noProjection.projection).toEqualTypeOf<undefined>()

// ✅ Can include sort, limit, skip
expectTypeOf({
  sort: { createdAt: -1 },
  limit: 20,
  skip: 10,
} satisfies QueryOptionsWithoutProjection<User>).toMatchTypeOf<
  QueryOptionsWithoutProjection<User>
>()

// ============================================================================
// PROJECTED DOCUMENT TYPE TESTS
// ============================================================================

/**
 * ProjectedDocument should correctly compute the resulting type based on projection.
 */

// ✅ ProjectedDocument with no keys returns full type
expectTypeOf({} as ProjectedDocument<User>).toEqualTypeOf<User>()
expectTypeOf({} as ProjectedDocument<User, never>).toEqualTypeOf<User>()

// ✅ ProjectedDocument with keys returns Pick including _id
type NameEmailProjection = ProjectedDocument<User, "name" | "email">
declare const projected1: NameEmailProjection
expectTypeOf(projected1._id).toEqualTypeOf<string>()
expectTypeOf(projected1.name).toEqualTypeOf<string>()
expectTypeOf(projected1.email).toEqualTypeOf<string>()

// ============================================================================
// COLLECTION FIND METHOD OVERLOAD TESTS
// ============================================================================

/**
 * Collection.find() should return correctly typed results based on projection options.
 */

declare const users: Collection<User>

// ✅ find() without projection returns full User[]
async function testFindNoProjection() {
  const results = await users.find({ active: true })
  expectTypeOf(results).toEqualTypeOf<readonly User[]>()

  // All fields should be accessible
  const user = results[0]
  if (!user) {
    return
  }
  expectTypeOf(user._id).toEqualTypeOf<string>()
  expectTypeOf(user.name).toEqualTypeOf<string>()
  expectTypeOf(user.email).toEqualTypeOf<string>()
  expectTypeOf(user.password).toEqualTypeOf<string>()
  expectTypeOf(user.age).toEqualTypeOf<number>()
}

// ✅ find() with select returns Pick<User, K | '_id'>[]
async function testFindWithSelect() {
  const results = await users.find(
    { active: true },
    { select: ["name", "email"] as const }
  )

  // Should return Pick<User, '_id' | 'name' | 'email'>[]
  const user = results[0]
  if (!user) {
    return
  }
  expectTypeOf(user._id).toEqualTypeOf<string>()
  expectTypeOf(user.name).toEqualTypeOf<string>()
  expectTypeOf(user.email).toEqualTypeOf<string>()

  // These fields should NOT exist on the projected type
  // @ts-expect-error - password not in projection
  user.password
  // @ts-expect-error - age not in projection
  user.age
  // @ts-expect-error - active not in projection
  user.active
}

// ✅ find() with omit returns Omit<User, K>[]
async function testFindWithOmit() {
  const results = await users.find(
    { active: true },
    { omit: ["password", "email"] as const }
  )

  // Should return Omit<User, 'password' | 'email'>[]
  const user = results[0]
  if (!user) {
    return
  }
  expectTypeOf(user._id).toEqualTypeOf<string>()
  expectTypeOf(user.name).toEqualTypeOf<string>()
  expectTypeOf(user.age).toEqualTypeOf<number>()
  expectTypeOf(user.active).toEqualTypeOf<boolean>()

  // These fields should NOT exist on the projected type
  // @ts-expect-error - password was omitted
  user.password
  // @ts-expect-error - email was omitted
  user.email
}

// ============================================================================
// COLLECTION FINDONE METHOD OVERLOAD TESTS
// ============================================================================

/**
 * Collection.findOne() should return correctly typed results based on projection options.
 */

// ✅ findOne() without projection returns User | null
async function testFindOneNoProjection() {
  const result = await users.findOne({ active: true })
  expectTypeOf(result).toEqualTypeOf<User | null>()

  if (result) {
    expectTypeOf(result._id).toEqualTypeOf<string>()
    expectTypeOf(result.name).toEqualTypeOf<string>()
    expectTypeOf(result.password).toEqualTypeOf<string>()
  }
}

// ✅ findOne() with select returns Pick<User, K | '_id'> | null
async function testFindOneWithSelect() {
  const result = await users.findOne(
    { active: true },
    { select: ["name", "age"] as const }
  )

  if (result) {
    expectTypeOf(result._id).toEqualTypeOf<string>()
    expectTypeOf(result.name).toEqualTypeOf<string>()
    expectTypeOf(result.age).toEqualTypeOf<number>()

    // These fields should NOT exist on the projected type
    // @ts-expect-error - password not in projection
    result.password
    // @ts-expect-error - email not in projection
    result.email
  }
}

// ✅ findOne() with omit returns Omit<User, K> | null
async function testFindOneWithOmit() {
  const result = await users.findOne(
    { active: true },
    { omit: ["password"] as const }
  )

  if (result) {
    expectTypeOf(result._id).toEqualTypeOf<string>()
    expectTypeOf(result.name).toEqualTypeOf<string>()
    expectTypeOf(result.email).toEqualTypeOf<string>()
    expectTypeOf(result.age).toEqualTypeOf<number>()

    // password should NOT exist on the projected type
    // @ts-expect-error - password was omitted
    result.password
  }
}

// ✅ findOne() by ID with select
async function testFindOneByIdWithSelect() {
  const result = await users.findOne("user-123", {
    select: ["name", "email"] as const,
  })

  if (result) {
    expectTypeOf(result._id).toEqualTypeOf<string>()
    expectTypeOf(result.name).toEqualTypeOf<string>()
    expectTypeOf(result.email).toEqualTypeOf<string>()

    // @ts-expect-error - password not in projection
    result.password
  }
}

// ============================================================================
// COLLECTION SEARCH METHOD OVERLOAD TESTS
// ============================================================================

/**
 * Collection.search() should return correctly typed results based on projection options.
 */

// ✅ search() without projection returns User[]
async function testSearchNoProjection() {
  const results = await users.search("alice", ["name", "email"])
  expectTypeOf(results).toEqualTypeOf<readonly User[]>()

  const user = results[0]
  if (!user) {
    return
  }
  expectTypeOf(user._id).toEqualTypeOf<string>()
  expectTypeOf(user.name).toEqualTypeOf<string>()
  expectTypeOf(user.password).toEqualTypeOf<string>()
}

// ✅ search() with select returns Pick<User, K | '_id'>[]
async function testSearchWithSelect() {
  const results = await users.search("alice", ["name", "email"], {
    select: ["name", "age"] as const,
  })

  const user = results[0]
  if (!user) {
    return
  }
  expectTypeOf(user._id).toEqualTypeOf<string>()
  expectTypeOf(user.name).toEqualTypeOf<string>()
  expectTypeOf(user.age).toEqualTypeOf<number>()

  // @ts-expect-error - password not in projection
  user.password
  // @ts-expect-error - email not in projection
  user.email
}

// ✅ search() with omit returns Omit<User, K>[]
async function testSearchWithOmit() {
  const results = await users.search("alice", ["name", "email"], {
    omit: ["password", "profile"] as const,
  })

  const user = results[0]
  if (!user) {
    return
  }
  expectTypeOf(user._id).toEqualTypeOf<string>()
  expectTypeOf(user.name).toEqualTypeOf<string>()
  expectTypeOf(user.email).toEqualTypeOf<string>()

  // @ts-expect-error - password was omitted
  user.password
  // @ts-expect-error - profile was omitted
  user.profile
}

// ✅ search() with select and filter
async function testSearchWithSelectAndFilter() {
  const results = await users.search("alice", ["name", "email"], {
    select: ["name", "role"] as const,
    filter: { active: true },
    sort: { name: 1 },
    limit: 10,
  })

  const user = results[0]
  if (!user) {
    return
  }
  expectTypeOf(user._id).toEqualTypeOf<string>()
  expectTypeOf(user.name).toEqualTypeOf<string>()
  expectTypeOf(user.role).toEqualTypeOf<"admin" | "user" | "guest">()

  // @ts-expect-error - email not in select
  user.email
}

// ============================================================================
// COMPLEX PROJECTION SCENARIOS
// ============================================================================

/**
 * Test complex scenarios with multiple fields and nested types.
 */

// ✅ Select with many fields
async function testSelectManyFields() {
  const results = await users.find(
    {},
    { select: ["name", "email", "age", "active", "role"] as const }
  )

  const user = results[0]
  if (!user) {
    return
  }
  expectTypeOf(user._id).toEqualTypeOf<string>()
  expectTypeOf(user.name).toEqualTypeOf<string>()
  expectTypeOf(user.email).toEqualTypeOf<string>()
  expectTypeOf(user.age).toEqualTypeOf<number>()
  expectTypeOf(user.active).toEqualTypeOf<boolean>()
  expectTypeOf(user.role).toEqualTypeOf<"admin" | "user" | "guest">()

  // @ts-expect-error - password not selected
  user.password
  // @ts-expect-error - tags not selected
  user.tags
  // @ts-expect-error - profile not selected
  user.profile
}

// ✅ Omit with many fields
async function testOmitManyFields() {
  const results = await users.find(
    {},
    { omit: ["password", "profile", "tags", "updatedAt"] as const }
  )

  const user = results[0]
  if (!user) {
    return
  }
  expectTypeOf(user._id).toEqualTypeOf<string>()
  expectTypeOf(user.name).toEqualTypeOf<string>()
  expectTypeOf(user.email).toEqualTypeOf<string>()
  expectTypeOf(user.age).toEqualTypeOf<number>()
  expectTypeOf(user.active).toEqualTypeOf<boolean>()

  // @ts-expect-error - password omitted
  user.password
  // @ts-expect-error - profile omitted
  user.profile
  // @ts-expect-error - tags omitted
  user.tags
  // @ts-expect-error - updatedAt omitted
  user.updatedAt
}

// ✅ Select with array field
async function testSelectArrayField() {
  const results = await users.find({}, { select: ["name", "tags"] as const })

  const user = results[0]
  if (!user) {
    return
  }
  expectTypeOf(user._id).toEqualTypeOf<string>()
  expectTypeOf(user.name).toEqualTypeOf<string>()
  expectTypeOf(user.tags).toEqualTypeOf<readonly string[]>()

  // @ts-expect-error - email not selected
  user.email
}

// ✅ Select with nested object field
async function testSelectNestedField() {
  const results = await users.find({}, { select: ["name", "profile"] as const })

  const user = results[0]
  if (!user) {
    return
  }
  expectTypeOf(user._id).toEqualTypeOf<string>()
  expectTypeOf(user.name).toEqualTypeOf<string>()
  expectTypeOf(user.profile).toEqualTypeOf<{
    readonly bio: string
    readonly avatar: string
  }>()

  // @ts-expect-error - email not selected
  user.email
}

// ============================================================================
// QUERY OPTIONS BASE TYPE TESTS
// ============================================================================

/**
 * QueryOptionsBase should contain common options without projection fields.
 */

// ✅ QueryOptionsBase has sort, limit, skip, search, cursor
declare const baseOptions: QueryOptionsBase<User>
expectTypeOf(baseOptions.sort).toEqualTypeOf<
  { readonly [K in keyof User]?: 1 | -1 } | undefined
>()
expectTypeOf(baseOptions.limit).toEqualTypeOf<number | undefined>()
expectTypeOf(baseOptions.skip).toEqualTypeOf<number | undefined>()

// ============================================================================
// INTEGRATION WITH QUERY OPTIONS TYPE
// ============================================================================

/**
 * Regular QueryOptions should still work for backwards compatibility.
 */

// ✅ QueryOptions accepts select as SelectSpec
expectTypeOf({
  select: ["name", "email"],
  sort: { name: 1 },
} satisfies QueryOptions<User>).toMatchTypeOf<QueryOptions<User>>()

// ✅ QueryOptions accepts omit as OmitSpec
expectTypeOf({
  omit: ["password"],
  limit: 10,
} satisfies QueryOptions<User>).toMatchTypeOf<QueryOptions<User>>()

// ✅ QueryOptions accepts projection
expectTypeOf({
  projection: { name: 1, email: 1 },
} satisfies QueryOptions<User>).toMatchTypeOf<QueryOptions<User>>()

// ============================================================================
// ENSURE TYPE SAFETY IS ENFORCED
// ============================================================================

/**
 * These tests verify that invalid projections cause type errors.
 */

// ❌ Cannot select fields that don't exist
async function testInvalidSelect() {
  // @ts-expect-error - 'nonexistent' is not a valid field
  await users.find({}, { select: ["name", "nonexistent"] as const })
}

// ❌ Cannot omit fields that don't exist
async function testInvalidOmit() {
  // @ts-expect-error - 'nonexistent' is not a valid field
  await users.find({}, { omit: ["password", "nonexistent"] as const })
}

// Suppress unused function warnings
void testFindNoProjection
void testFindWithSelect
void testFindWithOmit
void testFindOneNoProjection
void testFindOneWithSelect
void testFindOneWithOmit
void testFindOneByIdWithSelect
void testSearchNoProjection
void testSearchWithSelect
void testSearchWithOmit
void testSearchWithSelectAndFilter
void testSelectManyFields
void testOmitManyFields
void testSelectArrayField
void testSelectNestedField
void testInvalidSelect
void testInvalidOmit
