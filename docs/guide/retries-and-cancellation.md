# Retries & Cancellation

Retry callbacks use p-retry 9 semantics: `shouldConsumeRetry` runs before
`onFailedAttempt`, followed by `shouldRetry`. Context includes `retryDelay` in
milliseconds. When the signal aborts during an attempt or callback, its reason
wins and remaining callbacks are suppressed. Retrying remains opt-in.

`updateOne` honors operation retry options just like other write APIs:
`updateOne(id, update, { retry: false })` disables inherited retries. An explicit
operation retry policy merges over collection/database defaults, including its
custom predicate. Failed validation still rejects through the returned promise
and leaves the stored row and events unchanged. A custom predicate is authoritative
and can elect to retry errors the default classifier would reject.

StrataDB v0.4.0 introduces automatic retry logic for transient failures and AbortSignal support for canceling long-running operations.

## Operation Cancellation

All collection methods accept an optional `signal` parameter for cancellation using the standard `AbortSignal` API.

### Using AbortController

```typescript
import { AbortedError } from 'stratadb'

const controller = new AbortController()

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000)

try {
  const results = await users.find(
    { age: { $gte: 18 } },
    { signal: controller.signal }
  )
} catch (error) {
  if (error instanceof AbortedError) {
    console.log('Query was cancelled')
    console.log('Reason:', error.reason)
  }
}
```

### Using AbortSignal.timeout()

For simple timeout scenarios, use the built-in `AbortSignal.timeout()`:

```typescript
// Automatically abort after 5 seconds
const results = await users.find(
  { status: 'active' },
  { signal: AbortSignal.timeout(5000) }
)
```

### Cancellation with Custom Reasons

```typescript
const controller = new AbortController()

// Abort with a custom reason
controller.abort(new Error('User navigated away'))

try {
  await users.find({}, { signal: controller.signal })
} catch (error) {
  if (error instanceof AbortedError) {
    // error.reason contains: Error('User navigated away')
    console.log('Cancelled:', error.reason.message)
  }
}
```

### Cancelling Transactions

Transactions also support cancellation:

```typescript
const controller = new AbortController()

try {
  await db.execute(async (tx) => {
    const users = tx.collection('users', userSchema)
    await users.insertOne({ name: 'Alice' })
    await users.insertOne({ name: 'Bob' })
  }, { signal: controller.signal })
} catch (error) {
  if (error instanceof AbortedError) {
    // Transaction was rolled back
    console.log('Transaction cancelled')
  }
}
```

## Automatic Retries

StrataDB can automatically retry operations that fail due to transient errors like database locks or I/O errors.

### RetryOptions

The full `RetryOptions` type:

```typescript
type RetryOptions = {
  /** Maximum number of retry attempts. Default: 0 (no retries) */
  retries?: number

  /** Exponential backoff factor. Each retry delay is multiplied by this. Default: 2 */
  factor?: number

  /** Minimum delay in ms before the first retry. Default: 1000 */
  minTimeout?: number

  /** Maximum delay in ms between retries. Default: 30000 */
  maxTimeout?: number

  /** Randomize timeout by factor between 1-2. Default: true */
  randomize?: boolean

  /** Maximum total time in ms for all retry attempts. Default: Infinity */
  maxRetryTime?: number

  /** Callback invoked when a retry attempt fails */
  onFailedAttempt?: (context: RetryContext) => void | Promise<void>

  /** Callback to determine if a retry should occur */
  shouldRetry?: (context: RetryContext) => boolean | Promise<boolean>

  /** Callback to determine if failure should consume a retry from budget */
  shouldConsumeRetry?: (context: RetryContext) => boolean | Promise<boolean>
}
```

### Configuration Levels

Retry options can be configured at three levels, with later levels overriding earlier ones:

1. **Database level** - Default for all collections and operations
2. **Collection level** - Override database defaults for specific collections
3. **Operation level** - Override for individual operations

#### Database-Level Configuration

Set default retry behavior for all operations across all collections:

```typescript
const db = new Strata({
  database: 'app.db',
  retry: {
    retries: 3,
    factor: 2,
    minTimeout: 100,
    maxTimeout: 5000,
    randomize: true
  }
})

// All collections inherit these retry settings
const users = db.collection('users', userSchema)
const orders = db.collection('orders', orderSchema)
```

#### Collection-Level Configuration

Override database defaults for specific collections:

```typescript
const db = new Strata({
  database: 'app.db',
  retry: { retries: 3, minTimeout: 100 }
})

// Critical collection: more aggressive retries
const payments = db.collection('payments', paymentSchema, {
  retry: {
    retries: 5,
    minTimeout: 50,
    maxTimeout: 10000,
    maxRetryTime: 30000
  }
})

// Log collection: disable retries (writes are not critical)
const logs = db.collection('logs', logSchema, {
  retry: false
})

// Uses database defaults
const users = db.collection('users', userSchema)
```

#### Operation-Level Configuration

Override for individual operations:

```typescript
// Use aggressive retries for this critical insert
await users.insertOne(importantUser, {
  retry: {
    retries: 5,
    minTimeout: 50,
    factor: 1.5
  }
})

// Disable retries for a quick lookup
const user = await users.findOne(
  { email: 'user@example.com' },
  { retry: false }
)

// Custom retry with logging
await users.updateOne(userId, { lastLogin: Date.now() }, {
  retry: {
    retries: 3,
    onFailedAttempt: (context) => {
      console.log(`Attempt ${context.attemptNumber} failed: ${context.error.message}`)
      console.log(`Retries left: ${context.retriesLeft}`)
    }
  }
})
```

### Configuration Precedence

When options are set at multiple levels, they are merged with later levels taking precedence:

```typescript
const db = new Strata({
  database: 'app.db',
  retry: { retries: 3, minTimeout: 1000, maxTimeout: 30000 }
})

const users = db.collection('users', userSchema, {
  retry: { retries: 5, minTimeout: 500 }
})
// Effective: { retries: 5, minTimeout: 500, maxTimeout: 30000 }

await users.insertOne(doc, {
  retry: { minTimeout: 100 }
})
// Effective: { retries: 5, minTimeout: 100, maxTimeout: 30000 }
```

### Custom Retry Logic

Use the `shouldRetry` callback for fine-grained control:

```typescript
import { ValidationError, UniqueConstraintError } from 'stratadb'

await users.insertOne(userData, {
  retry: {
    retries: 3,
    shouldRetry: (context) => {
      const { error } = context

      // Never retry validation errors
      if (error instanceof ValidationError) return false
      if (error instanceof UniqueConstraintError) return false

      // Only retry if we haven't exceeded 5 seconds total
      if (context.elapsedTime > 5000) return false

      // Retry everything else
      return true
    }
  }
})
```

### Default Retry Behavior

Retries are disabled unless configured. Enabled retries automatically use the exported `defaultShouldRetry` policy, which classifies these failures as retryable. A custom `shouldRetry` predicate overrides it:

- **ConnectionError** - Database connection issues
- **TransactionError** - Transaction conflicts
- **SQLite error codes**:
  - `5` (SQLITE_BUSY) - Database is locked
  - `6` (SQLITE_LOCKED) - Table is locked
  - `7` (SQLITE_NOMEM) - Out of memory
  - `10` (SQLITE_IOERR) - Disk I/O error

This policy excludes the following errors and unknown errors:

- `ValidationError`
- `SchemaValidationError`
- `UniqueConstraintError`
- `ConstraintError`

### Retry Callbacks

#### onFailedAttempt

Called after each failed attempt, useful for logging or metrics:

```typescript
await users.insertMany(bulkData, {
  retry: {
    retries: 3,
    onFailedAttempt: async (context) => {
      console.error(`Insert failed (attempt ${context.attemptNumber}/${context.retries + 1})`)
      console.error(`Error: ${context.error.message}`)
      console.error(`Retrying in ${context.delay}ms...`)

      // Send to monitoring
      await metrics.recordRetry({
        operation: 'insertMany',
        attempt: context.attemptNumber,
        error: context.error.message
      })
    }
  }
})
```

#### shouldConsumeRetry

Control whether a failure counts against the retry budget:

```typescript
await users.find({}, {
  retry: {
    retries: 3,
    shouldConsumeRetry: (context) => {
      // Don't count rate limit errors against retry budget
      if (context.error.message.includes('rate limit')) {
        return false
      }
      return true
    }
  }
})
```

## Combining Cancellation and Retries

AbortSignal works seamlessly with retries - aborting cancels any pending retry:

```typescript
const controller = new AbortController()

// Set a 10 second overall timeout
setTimeout(() => controller.abort(), 10000)

try {
  await users.insertOne(doc, {
    signal: controller.signal,
    retry: {
      retries: 5,
      minTimeout: 500,
      onFailedAttempt: (context) => {
        console.log(`Attempt ${context.attemptNumber} failed, will retry...`)
      }
    }
  })
} catch (error) {
  if (error instanceof AbortedError) {
    console.log('Operation cancelled (possibly during a retry)')
  }
}
```

## Utility Functions

StrataDB exports retry utilities for custom use cases:

### withRetry

Wrap any async operation with retry logic:

```typescript
import { withRetry } from 'stratadb'

const result = await withRetry(
  async () => {
    // Your async operation
    return await fetchExternalAPI()
  },
  {
    retries: 3,
    minTimeout: 500,
    signal: controller.signal
  }
)
```

### defaultShouldRetry

The default retry logic used by StrataDB:

```typescript
import { defaultShouldRetry } from 'stratadb'

await users.insertOne(doc, {
  retry: {
    retries: 3,
    shouldRetry: (context) => {
      // Use default logic plus custom condition
      if (!defaultShouldRetry(context)) return false

      // Add custom condition
      return context.attemptNumber <= 2
    }
  }
})
```

### mergeRetryOptions

Merge retry options from multiple sources:

```typescript
import { mergeRetryOptions } from 'stratadb'

const databaseDefaults = { retries: 3, minTimeout: 1000 }
const collectionOverrides = { retries: 5 }
const operationOverrides = { minTimeout: 100 }

const merged = mergeRetryOptions(
  databaseDefaults,
  collectionOverrides,
  operationOverrides
)
// Result: { retries: 5, minTimeout: 100 }
```

## Error Handling

### AbortedError

Thrown when an operation is cancelled via AbortSignal:

```typescript
import { AbortedError } from 'stratadb'

try {
  await users.find({}, { signal: AbortSignal.timeout(100) })
} catch (error) {
  if (error instanceof AbortedError) {
    console.log('Code:', error.code)       // 'OPERATION_ABORTED'
    console.log('Category:', error.category) // 'database'
    console.log('Reason:', error.reason)   // The abort reason
  }
}
```

### Retry Context

The `RetryContext` object passed to callbacks contains:

```typescript
type RetryContext = {
  error: Error           // The error that triggered the retry
  attemptNumber: number  // Current attempt (1-indexed)
  retriesLeft: number    // Remaining retry attempts
  retries: number        // Total configured retries
  elapsedTime: number    // Time elapsed since first attempt (ms)
  delay: number          // Delay before this retry (ms)
}
```
