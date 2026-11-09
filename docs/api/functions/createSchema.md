[stratadb](../index.md) / createSchema

# Function: createSchema()

```ts
function createSchema<T>(): SchemaBuilder<Document<T>>;
```

Defined in: [src/schema-builder.ts:274](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/schema-builder.ts#L274)

Creates a new schema builder for defining collection schemas.

## Type Parameters

### T

`T` *extends* `Record`&lt;`string`, `unknown`&gt; = `Record`&lt;`string`, `unknown`&gt;

The document payload type (without _id, createdAt, updatedAt)

## Returns

[`SchemaBuilder`](../type-aliases/SchemaBuilder.md)&lt;[`Document`](../type-aliases/Document.md)&lt;`T`&gt;&gt;

A new SchemaBuilder instance for `Document<T>`

## Remarks

This factory function creates a new `SchemaBuilder<Document<T>>` that provides
a fluent API for constructing schemas. The builder ensures type safety
at every step and returns an immutable schema definition when built.

**Important**: Pass your payload type (without Document wrapper) to createSchema.
The function automatically wraps it with `Document<T>` which adds _id, createdAt, updatedAt.

## Example

```typescript
import { createSchema, type Document } from 'stratadb';

// Define your payload type (no _id needed!)
type UserPayload = {
  name: string;
  email: string;
  age: number;
  status: 'active' | 'inactive';
};

// The full document type includes _id automatically
type User = Document<UserPayload>;

// ✅ Create schema using payload type
const userSchema = createSchema<UserPayload>()
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .field('age', { type: 'INTEGER', indexed: true })
  .field('status', { type: 'TEXT', indexed: true })
  .compoundIndex('age_status', ['age', 'status'])
  .timestamps(true)
  .build();

// ✅ Use with database (User type has _id automatically)
const users = db.collection<User>('users', userSchema);
```
