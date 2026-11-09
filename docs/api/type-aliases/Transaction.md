[stratadb](../index.md) / Transaction

# Type Alias: Transaction

```ts
type Transaction = object;
```

Defined in: [src/database-types.ts:201](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/database-types.ts#L201)

Transaction interface for atomic multi-operation execution.

## Remarks

Transactions ensure that multiple operations either all succeed or all fail.
Uses SQLite's transaction support underneath. Implements Symbol.dispose for
automatic rollback if commit is not called.

## Example

```typescript
// Using try/finally pattern
const tx = db.transaction();
try {
  const users = tx.collection('users', userSchema);
  await users.insertOne({ name: 'Alice' });
  await users.insertOne({ name: 'Bob' });
  tx.commit();
} catch (error) {
  tx.rollback();
  throw error;
}

// Using Symbol.dispose (automatic rollback on scope exit)
using tx = db.transaction();
const users = tx.collection('users', userSchema);
await users.insertOne({ name: 'Alice' });
tx.commit(); // Must call commit, otherwise rollback on scope exit
```

## Methods

### \[dispose\]()

```ts
[dispose](): void;
```

Defined in: [src/database-types.ts:228](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/database-types.ts#L228)

Disposes the transaction (rolls back if not committed).
Enables `using tx = db.transaction()` syntax.

#### Returns

`void`

***

### collection()

```ts
collection<T>(name, schema): Collection<T>;
```

Defined in: [src/database-types.ts:209](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/database-types.ts#L209)

Gets a collection within this transaction.

#### Type Parameters

##### T

`T` *extends* [`Document`](Document.md)

#### Parameters

##### name

`string`

Collection name

##### schema

[`SchemaDefinition`](SchemaDefinition.md)&lt;`T`&gt;

Schema definition for the collection

#### Returns

[`Collection`](Collection.md)&lt;`T`&gt;

Collection bound to this transaction

***

### commit()

```ts
commit(): void;
```

Defined in: [src/database-types.ts:217](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/database-types.ts#L217)

Commits all changes made within this transaction.

#### Returns

`void`

***

### rollback()

```ts
rollback(): void;
```

Defined in: [src/database-types.ts:222](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/database-types.ts#L222)

Rolls back all changes made within this transaction.

#### Returns

`void`
