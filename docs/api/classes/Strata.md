[stratadb](../index.md) / Strata

# Class: Strata

Defined in: [src/stratadb.ts:63](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/stratadb.ts#L63)

Main StrataDB database class.

## Remarks

StrataDB provides a MongoDB-like document database API backed by SQLite.
It manages collections, transactions, and database lifecycle.

**Features:**
- Type-safe document operations
- JSONB storage with indexed generated columns
- Transaction support with automatic rollback
- Symbol.dispose for automatic cleanup

## Example

```typescript
// Create database with path
const db = new Strata({ database: 'myapp.db' });

// Create in-memory database
const memDb = new Strata({ database: ':memory:' });

// With custom options
const customDb = new Strata({
  database: 'app.db',
  idGenerator: () => `custom-${Date.now()}`,
  onClose: () => console.log('Database closed'),
  debug: true
});

// Using with automatic cleanup
using db = new Strata({ database: ':memory:' });
const users = db.collection('users', userSchema);
// Database automatically closes when scope exits
```

## Implements

- [`StrataDB`](../type-aliases/StrataDB.md)

## Constructors

### Constructor

```ts
new Strata(options): Strata;
```

Defined in: [src/stratadb.ts:77](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/stratadb.ts#L77)

Creates a new StrataDB instance.

#### Parameters

##### options

[`DatabaseOptions`](../type-aliases/DatabaseOptions.md)

Database configuration options

#### Returns

`Strata`

## Properties

### sqliteDb

```ts
readonly sqliteDb: Database;
```

Defined in: [src/stratadb.ts:64](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/stratadb.ts#L64)

Direct access to the underlying SQLite database.
Use for advanced operations not covered by StrataDB API.

#### Implementation of

`StrataDBInterface.sqliteDb`

## Methods

### \[dispose\]()

```ts
[dispose](): void;
```

Defined in: [src/stratadb.ts:234](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/stratadb.ts#L234)

Disposes the database (closes connection).

#### Returns

`void`

#### Implementation of

`StrataDBInterface.[dispose]`

***

### close()

```ts
close(): void;
```

Defined in: [src/stratadb.ts:220](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/stratadb.ts#L220)

Closes the database connection.

#### Returns

`void`

#### Implementation of

`StrataDBInterface.close`

***

### collection()

Implementation of overloaded collection method.

#### Call Signature

```ts
collection<T>(
   name,
   schema,
   options?
): Collection<T>;
```

Defined in: [src/stratadb.ts:124](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/stratadb.ts#L124)

Gets or creates a collection with a pre-built schema.

##### Type Parameters

###### T

`T` *extends* [`Document`](../type-aliases/Document.md)

##### Parameters

###### name

`string`

###### schema

[`SchemaDefinition`](../type-aliases/SchemaDefinition.md)&lt;`T`&gt;

###### options?

`CollectionOptions`

##### Returns

[`Collection`](../type-aliases/Collection.md)&lt;`T`&gt;

##### Implementation of

`StrataDBInterface.collection`

#### Call Signature

```ts
collection<T>(name): CollectionBuilder<T>;
```

Defined in: [src/stratadb.ts:133](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/stratadb.ts#L133)

Creates a collection builder for fluent schema definition.

##### Type Parameters

###### T

`T` *extends* [`Document`](../type-aliases/Document.md)

##### Parameters

###### name

`string`

##### Returns

[`CollectionBuilder`](../type-aliases/CollectionBuilder.md)&lt;`T`&gt;

##### Implementation of

`StrataDBInterface.collection`

***

### execute()

```ts
execute<R>(fn, options?): Promise<R>;
```

Defined in: [src/stratadb.ts:203](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/stratadb.ts#L203)

Executes a function within a transaction.

#### Type Parameters

##### R

`R`

#### Parameters

##### fn

(`tx`) => `R` \| `Promise`&lt;`R`&gt;

Function to execute

##### options?

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`R`&gt;

Result of the function

#### Implementation of

`StrataDBInterface.execute`

***

### generateId()

```ts
generateId(): string;
```

Defined in: [src/stratadb.ts:117](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/stratadb.ts#L117)

Generates a new unique ID using the configured ID generator.

#### Returns

`string`

A new unique identifier string

#### Implementation of

`StrataDBInterface.generateId`

***

### transaction()

```ts
transaction(): Transaction;
```

Defined in: [src/stratadb.ts:193](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/stratadb.ts#L193)

Creates a transaction handle; nested handles use savepoints.

#### Returns

[`Transaction`](../type-aliases/Transaction.md)

#### Implementation of

`StrataDBInterface.transaction`
