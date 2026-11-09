# Transactions

Transactions ensure multiple operations either all succeed or all fail together (atomicity).

## Basic Transaction

```typescript
const tx = db.transaction()
try {
  const users = tx.collection('users', userSchema)
  const accounts = tx.collection('accounts', accountSchema)

  await users.insertOne({ name: 'Alice', email: 'alice@example.com' })
  await accounts.insertOne({ userId: 'alice', balance: 100 })

  tx.commit()
} catch (error) {
  tx.rollback()
  throw error
}
```

## Using Symbol.dispose (Recommended)

With TypeScript 5.2+, use `using` for automatic cleanup:

```typescript
{
  using tx = db.transaction()
  const users = tx.collection('users', userSchema)

  await users.insertOne({ name: 'Alice', email: 'alice@example.com' })
  await users.insertOne({ name: 'Bob', email: 'bob@example.com' })

  tx.commit()  // Must call commit, otherwise auto-rollback
}
// Transaction automatically rolled back if commit wasn't called
```

## Execute Helper

The `execute` method handles commit/rollback automatically:

```typescript
await db.execute(async (tx) => {
  const users = tx.collection('users', userSchema)
  const logs = tx.collection('logs', logSchema)

  const user = await users.insertOne({ name: 'Alice' })
  await logs.insertOne({ action: 'user_created', userId: user._id })

  return user
})
// Commits on success, rolls back on error
```

## Nested Transactions and Concurrent Work

Nested `execute()` calls and manual transaction handles use savepoints. A failed inner call rolls back its own changes; catch that error inside the outer callback to continue and commit the remaining changes. Every write method, including batch operations and `drop()`, works inside `execute()`.

```typescript
await db.execute(async () => {
  await users.insertOne(firstUser)
  try {
    await db.execute(async () => {
      await users.insertOne(secondUser)
      throw new Error('Discard the second user')
    })
  } catch {
    // The first insert remains in the outer transaction.
  }
})
```

Competing `execute()` calls run in call order. Operations issued outside a pending callback wait until it completes, so its rollback cannot capture another caller's write. Operations awaited inside the callback join its transaction, including calls on an existing collection instance. Create collections beforehand or inside the callback; synchronous collection/transaction creation cannot enter another caller's pending `execute()`.

Await every transaction operation. Await independent queued work after the transaction finishes. Use `execute()` for concurrent application work; complete manual handles in nesting order. Committing, rolling back and disposing a completed handle are idempotent.

Collection events wait for the outermost commit. Savepoint rollback discards its events, and outer rollback discards all buffered events. See [event delivery guarantees](/guide/events#event-timing).

## Error Handling

```typescript
try {
  await db.execute(async (tx) => {
    const users = tx.collection('users', userSchema)

    await users.insertOne({ email: 'alice@example.com' })
    await users.insertOne({ email: 'alice@example.com' })  // Duplicate!
  })
} catch (error) {
  // Transaction was automatically rolled back
  // First insert was also undone
  console.error('Transaction failed:', error)
}
```

## Use Cases

### Transferring Funds

```typescript
await db.execute(async (tx) => {
  const accounts = tx.collection('accounts', accountSchema)

  const from = await accounts.findById(fromId)
  const to = await accounts.findById(toId)

  if (!from || !to) throw new Error('Account not found')
  if (from.balance < amount) throw new Error('Insufficient funds')

  await accounts.updateOne(fromId, { balance: from.balance - amount })
  await accounts.updateOne(toId, { balance: to.balance + amount })
})
```

### Creating Related Records

```typescript
await db.execute(async (tx) => {
  const users = tx.collection('users', userSchema)
  const profiles = tx.collection('profiles', profileSchema)
  const settings = tx.collection('settings', settingsSchema)

  const user = await users.insertOne({ email: 'new@example.com' })

  await profiles.insertOne({
    userId: user._id,
    displayName: 'New User'
  })

  await settings.insertOne({
    userId: user._id,
    theme: 'dark',
    notifications: true
  })

  return user
})
```

## Sharing a Transaction Handle

StrataDB nests transactions with savepoints. Pass a transaction handle to share its scope, or call `execute()` again to create an independently rollbackable savepoint. See [nested transactions and concurrent work](#nested-transactions-and-concurrent-work).

```typescript
await db.execute(async (tx) => {
  // This is the outer transaction
  await someFunction(tx)  // Pass tx to nested functions
})

async function someFunction(tx: Transaction) {
  const users = tx.collection('users', userSchema)
  // Uses the same transaction
}
```
