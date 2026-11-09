[stratadb](../index.md) / SchemaBuilder

# Type Alias: SchemaBuilder&lt;T&gt;

```ts
type SchemaBuilder<T> = object;
```

Defined in: [src/schema-builder-types.ts:50](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/schema-builder-types.ts#L50)

Fluent builder interface for defining collection schemas.

## Remarks

Provides a chainable API for defining fields, indexes, timestamps, and validation.
Each method returns `this` to enable method chaining, creating an excellent
developer experience with full IntelliSense support.

Use the `createSchema<T>()` helper function to create a schema builder instance.
The builder pattern ensures schemas are constructed in a type-safe manner,
catching configuration errors at compile time.

## Example

```typescript
import { createSchema, type Document } from 'stratadb';

type User = Document<{
  name: string;
  email: string;
  age: number;
  status: 'active' | 'inactive';
}>;

// ✅ Build schema with fluent API
const userSchema = createSchema<User>()
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .field('age', { type: 'INTEGER', indexed: true })
  .field('status', { type: 'TEXT', indexed: true })
  .compoundIndex('age_status', ['age', 'status'])
  .timestamps(true)
  .validate((doc): doc is User => {
    return typeof doc === 'object' &&
           doc !== null &&
           'name' in doc &&
           typeof doc.name === 'string';
  })
  .build();

// Use with database collection
const users = db.collection<User>('users', userSchema);
```

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type extending Document

## Methods

### build()

```ts
build(): SchemaDefinition<T>;
```

Defined in: [src/schema-builder-types.ts:242](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/schema-builder-types.ts#L242)

Build and return the complete schema definition.

#### Returns

[`SchemaDefinition`](SchemaDefinition.md)&lt;`T`&gt;

The immutable schema definition

#### Remarks

Finalizes the schema construction and returns an immutable `SchemaDefinition<T>`
that can be used to create collections. Once built, the schema cannot be modified.

This method completes the builder chain and should always be the final call.

#### Example

```typescript
// ✅ Build the schema
const schema = createSchema<User>()
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .timestamps(true)
  .build();

// ✅ Use with collection
const users = db.collection<User>('users', schema);

// ❌ Cannot modify after building
// schema.field('age', { type: 'INTEGER' }); // Error: build() returns SchemaDefinition
```

***

### compoundIndex()

```ts
compoundIndex(
   name, 
   fields, 
   options?
): SchemaBuilder<T>;
```

Defined in: [src/schema-builder-types.ts:135](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/schema-builder-types.ts#L135)

Define a compound index spanning multiple fields.

#### Parameters

##### name

`string`

Unique name for the index

##### fields

readonly (`string` \| keyof `T`)[]

Array of field names (order matters, supports dot notation for nested fields)

##### options?

Index options (unique constraint)

###### unique?

`boolean`

#### Returns

`SchemaBuilder`&lt;`T`&gt;

This builder instance for method chaining

#### Remarks

Compound indexes improve query performance when filtering by multiple fields together.
Field names can use dot notation to reference nested properties.
The order of fields matters - queries must use fields from left to right for the
index to be effective.

#### Example

```typescript
// ✅ Compound index for top-level fields
.compoundIndex('age_status', ['age', 'status'])

// ✅ Compound index with nested fields
.compoundIndex('watchlist_active', ['watchlistItem.ticker', 'isActive'])

// ✅ Unique compound constraint
.compoundIndex('email_tenant', ['email', 'tenantId'], { unique: true })

// Query optimization example:
// This index helps with queries like:
// - { age: 30, status: 'active' }  ✅ Uses index fully
// - { age: { $gte: 25 } }          ✅ Uses index partially (age only)
// - { status: 'active' }           ❌ Cannot use index (doesn't start with 'age')
```

***

### field()

```ts
field<K>(name, options): SchemaBuilder<T>;
```

Defined in: [src/schema-builder-types.ts:85](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/schema-builder-types.ts#L85)

Define an indexed field with type checking.

#### Type Parameters

##### K

`K` *extends* `string` \| `number` \| `symbol`

#### Parameters

##### name

`K`

The field name (supports dot notation for nested fields like 'profile.bio' or 'watchlistItem.ticker')

##### options

Field configuration options

###### default?

`unknown`

Default value when not provided

###### indexed?

`boolean`

Create index for faster queries

###### nullable?

`boolean`

Whether field can be null

###### path?

[`JsonPath`](JsonPath.md)

JSON path (defaults to $.\{name\} if omitted, or auto-generated from dot notation)

###### type

`string`

SQLite column type

###### unique?

`boolean`

Enforce uniqueness constraint

#### Returns

`SchemaBuilder`&lt;`T`&gt;

This builder instance for method chaining

#### Remarks

Field names support dot notation for accessing nested properties.
When a dot is detected in the name, it automatically becomes the JSON path.

For top-level fields, the path defaults to `$.{name}`.
For nested fields like 'profile.bio', the path becomes '$.profile.bio'.
For deeply nested fields, any nesting depth is supported.

#### Example

```typescript
// ✅ Top-level fields
.field('name', { type: 'TEXT', indexed: true })
.field('email', { type: 'TEXT', indexed: true, unique: true })

// ✅ Nested fields with dot notation
.field('profile.bio', { type: 'TEXT', indexed: true })
.field('watchlistItem.ticker', { type: 'TEXT', indexed: true })
.field('user.settings.theme', { type: 'TEXT', indexed: true })

// ✅ Field with default value
.field('status', {
  type: 'TEXT',
  indexed: true,
  default: 'active'
})
```

***

### timestamps()

```ts
timestamps(enabled?): SchemaBuilder<T>;
```

Defined in: [src/schema-builder-types.ts:170](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/schema-builder-types.ts#L170)

Enable automatic timestamp management.

#### Parameters

##### enabled?

`boolean`

Whether to auto-manage createdAt/updatedAt (default: true)

#### Returns

`SchemaBuilder`&lt;`T`&gt;

This builder instance for method chaining

#### Remarks

When enabled, automatically adds `createdAt` timestamp on insert and
updates `updatedAt` timestamp on modifications. This is useful for
audit trails and tracking document lifecycle.

The timestamps are stored as ISO 8601 strings in SQLite and exposed
as Date objects in TypeScript.

#### Example

```typescript
// ✅ Enable timestamps
.timestamps(true)

// ✅ Disable timestamps (default if not called)
.timestamps(false)

// After enabling, your documents will have:
interface UserWithTimestamps extends User {
  createdAt: Date;
  updatedAt: Date;
}
```

***

### validate()

```ts
validate(validator): SchemaBuilder<T>;
```

Defined in: [src/schema-builder-types.ts:213](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/schema-builder-types.ts#L213)

Add validation function using a type predicate.

#### Parameters

##### validator

(`doc`) => `doc is T`

Function that validates and narrows the document type

#### Returns

`SchemaBuilder`&lt;`T`&gt;

This builder instance for method chaining

#### Remarks

The validation function is a type predicate that narrows `unknown` to your
document type `T`. This runs at runtime before inserting or updating documents.

For Standard Schema validators (Zod, Valibot, ArkType, etc.), this method
wraps the validator's validation logic. You can also provide custom validation
logic directly.

#### Example

```typescript
// ✅ Custom validation function
.validate((doc): doc is User => {
  return typeof doc === 'object' &&
         doc !== null &&
         'name' in doc &&
         typeof doc.name === 'string' &&
         'email' in doc &&
         typeof doc.email === 'string' &&
         /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.email);
})

// ✅ Using with Zod (Standard Schema)
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().min(0)
});

.validate((doc): doc is User => {
  return UserSchema.safeParse(doc).success;
})
```
