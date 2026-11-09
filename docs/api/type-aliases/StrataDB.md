[stratadb](../index.md) / StrataDB

# Type Alias: StrataDB

```ts
type StrataDB = object;
```

Defined in: [src/database-types.ts:257](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L257)

Main StrataDB interface for database operations.

## Remarks

StrataDB provides a MongoDB-like API backed by SQLite. It manages collections,
transactions, and database lifecycle. Implements Symbol.dispose for automatic cleanup.

## Example

```typescript
// Create database
const db = new StrataDB({ database: 'myapp.db' });

// Get or create a collection
const users = db.collection('users', userSchema);

// Insert documents
await users.insertOne({ name: 'Alice', email: 'alice@example.com' });

// Query documents
const adults = await users.find({ age: { $gte: 18 } });

// Close database when done
db.close();
```

## Properties

### sqliteDb

```ts
readonly sqliteDb: SQLiteDatabase;
```

Defined in: [src/database-types.ts:262](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L262)

Direct access to the underlying SQLite database.
Use for advanced operations not covered by StrataDB API.

## Methods

### \[dispose\]()

```ts
[dispose](): void;
```

Defined in: [src/database-types.ts:363](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L363)

Disposes the database (closes connection).
Enables `using db = new StrataDB(...)` syntax.

#### Returns

`void`

***

### close()

```ts
close(): void;
```

Defined in: [src/database-types.ts:357](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L357)

Closes the database connection.

#### Returns

`void`

***

### collection()

#### Call Signature

```ts
collection<T>(
   name,
   schema,
   options?
): Collection<T>;
```

Defined in: [src/database-types.ts:288](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L288)

Gets or creates a collection with a pre-built schema.

##### Type Parameters

###### T

`T` *extends* [`Document`](Document.md)

##### Parameters

###### name

`string`

Collection name (table name in SQLite)

###### schema

[`SchemaDefinition`](SchemaDefinition.md)&lt;`T`&gt;

Schema definition for type safety and validation

###### options?

`CollectionOptions`

Optional collection-specific configuration

##### Returns

[`Collection`](Collection.md)&lt;`T`&gt;

Collection instance for the specified type

##### Example

```typescript
// Default cache behavior (inherits from database)
const users = db.collection('users', userSchema);

// Override cache setting for this collection
const logs = db.collection('logs', logSchema, { enableCache: false });
```

#### Call Signature

```ts
collection<T>(name): CollectionBuilder<T>;
```

Defined in: [src/database-types.ts:308](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L308)

Creates a collection builder for fluent schema definition.

##### Type Parameters

###### T

`T` *extends* [`Document`](Document.md)

##### Parameters

###### name

`string`

Collection name (table name in SQLite)

##### Returns

[`CollectionBuilder`](CollectionBuilder.md)&lt;`T`&gt;

CollectionBuilder for defining schema inline

##### Example

```typescript
const users = db.collection<User>('users')
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .build();
```

***

### execute()

```ts
execute<R>(fn, options?): Promise<R>;
```

Defined in: [src/database-types.ts:349](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L349)

Executes a function within a transaction.

#### Type Parameters

##### R

`R`

#### Parameters

##### fn

(`tx`) => `R` \| `Promise`&lt;`R`&gt;

Function to execute within transaction

##### options?

Optional options including signal for cancellation

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`R`&gt;

Result of the function

#### Remarks

Automatically commits on success, rolls back on error.

#### Example

```typescript
await db.execute(async (tx) => {
  const users = tx.collection('users', userSchema);
  await users.insertOne({ name: 'Alice' });
  await users.insertOne({ name: 'Bob' });
});

// With abort signal
const controller = new AbortController();
await db.execute(async (tx) => {
  // transaction operations
}, { signal: controller.signal });
```

***

### generateId()

```ts
generateId(): string;
```

Defined in: [src/database-types.ts:269](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L269)

Generates a new unique ID using the configured ID generator.

#### Returns

`string`

A new unique identifier string

***

### transaction()

```ts
transaction(): Transaction;
```

Defined in: [src/database-types.ts:322](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L322)

Creates a new transaction for atomic operations.

#### Returns

[`Transaction`](Transaction.md)

Transaction instance

#### Example

```typescript
using tx = db.transaction();
// operations...
tx.commit();
```
