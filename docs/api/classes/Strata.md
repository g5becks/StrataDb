[stratadb](../index.md) / Strata

# Class: Strata

Defined in: [src/stratadb.ts:74](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/stratadb.ts#L74)

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

Defined in: [src/stratadb.ts:90](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/stratadb.ts#L90)

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

Defined in: [src/stratadb.ts:75](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/stratadb.ts#L75)

Direct access to the underlying SQLite database.
Use for advanced operations not covered by StrataDB API.

#### Implementation of

`StrataDBInterface.sqliteDb`

## Methods

### \[dispose\]()

```ts
[dispose](): void;
```

Defined in: [src/stratadb.ts:267](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/stratadb.ts#L267)

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

Defined in: [src/stratadb.ts:252](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/stratadb.ts#L252)

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

Defined in: [src/stratadb.ts:148](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/stratadb.ts#L148)

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

Defined in: [src/stratadb.ts:157](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/stratadb.ts#L157)

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

Defined in: [src/stratadb.ts:235](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/stratadb.ts#L235)

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

Defined in: [src/stratadb.ts:141](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/stratadb.ts#L141)

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

Defined in: [src/stratadb.ts:225](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/stratadb.ts#L225)

Creates a transaction handle; nested handles use savepoints.

#### Returns

[`Transaction`](../type-aliases/Transaction.md)

#### Implementation of

`StrataDBInterface.transaction`
