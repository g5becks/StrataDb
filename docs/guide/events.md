# Collection Events

StrataDB collections emit events when documents are created, updated, or deleted. This enables reactive patterns like audit logging, cache invalidation, and real-time notifications.

## Quick Start

```typescript
import { Strata, createSchema, type Document } from 'stratadb'

type User = Document<{
  name: string
  email: string
  age: number
}>

const db = new Strata({ database: 'app.db' })
const users = db.collection<User>('users')
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .field('age', { type: 'INTEGER', indexed: true })
  .build()

// Listen for insert events
users.on('insert', (event) => {
  console.log('User created:', event.document.name)
  console.log('ID:', event.document._id)
})

// Listen for update events
users.on('update', (event) => {
  console.log('User updated:', event.document?.name)
  console.log('Upserted:', event.upserted)
})

// Listen for delete events
users.on('delete', (event) => {
  console.log('Deleted:', event.deleted)
})

// Now perform operations - events will fire
await users.insertOne({ name: 'Alice', email: 'alice@example.com', age: 30 })
await users.updateOne('user-id', { age: 31 })
await users.deleteOne('user-id')
```

## Available Events

| Event Name | Trigger | Payload |
|------------|---------|---------|
| `insert` | After `insertOne` succeeds | `{ document: T }` |
| `insertMany` | After `insertMany` succeeds | `{ documents: readonly T[], insertedCount: number }` |
| `update` | After `updateOne` succeeds | `{ filter: string \| QueryFilter<T>, update: Partial<T>, document: T \| null, upserted: boolean }` |
| `updateMany` | After `updateMany` succeeds | `{ filter: QueryFilter<T>, update: Partial<T>, matchedCount: number, modifiedCount: number }` |
| `replace` | After `replaceOne` succeeds | `{ filter: string \| QueryFilter<T>, document: T \| null }` |
| `delete` | After `deleteOne` succeeds | `{ filter: string \| QueryFilter<T>, deleted: boolean }` |
| `deleteMany` | After `deleteMany` succeeds | `{ filter: QueryFilter<T>, deletedCount: number }` |
| `findOneAndDelete` | After `findOneAndDelete` succeeds | `{ filter: string \| QueryFilter<T>, document: T \| null }` |
| `findOneAndUpdate` | After `findOneAndUpdate` succeeds | `{ filter: string \| QueryFilter<T>, update: Partial<T>, document: T \| null, upserted: boolean }` |
| `findOneAndReplace` | After `findOneAndReplace` succeeds | `{ filter: string \| QueryFilter<T>, document: T \| null, upserted: boolean }` |
| `drop` | After collection is dropped | `{ name: string }` |
| `error` | When an event listener fails | `{ operation: string, error: Error, context?: unknown }` |

## Event Timing

Events are delivered synchronously after commit, in listener registration order, at most once per listener registration and emitted event. Inside `execute()` or a manual transaction, delivery waits for the outermost commit; rollback discards its events. Nested savepoint commits defer delivery to their parent.

Listener exceptions never reject a committed write or trigger a database retry. Each listener runs independently, so later listeners still receive the event. `once()` listeners are removed before invocation, even if they throw. A failing listener is reported through the collection's `error` listeners with `operation` set to its event name and `context.source` set to `listener`. Without an error observer, StrataDB logs the failure with `console.error`. Failures in error observers are logged without recursively emitting another error event.

Async listeners start in registration order, but their completion is not awaited by the write. Their promise rejections follow the same error-reporting path. Await database operations explicitly and use their returned promise to handle operation failures.

These guarantees mean:

- The document is committed when the event fires
- You can safely query for the document in the event handler
- If the operation fails, no event is emitted
- Event listeners cannot prevent the operation from completing

```typescript
users.on('insert', async (event) => {
  // Document is already in the database
  const found = await users.findOne(event.document._id)
  console.log('Found:', found !== null) // true
})

await users.insertOne({ name: 'Bob', email: 'bob@example.com', age: 25 })
```

## Use Cases

### Audit Logging

Track all changes to a collection for compliance:

```typescript
import { appendFileSync } from 'fs'

// Log all user modifications
users.on('insert', (event) => {
  const log = {
    timestamp: new Date().toISOString(),
    action: 'CREATE',
    userId: event.document._id,
    data: event.document
  }
  appendFileSync('audit.log', JSON.stringify(log) + '\n')
})

users.on('update', (event) => {
  const log = {
    timestamp: new Date().toISOString(),
    action: event.upserted ? 'CREATE' : 'UPDATE',
    userId: event.document?._id,
    changes: event.update
  }
  appendFileSync('audit.log', JSON.stringify(log) + '\n')
})

users.on('delete', (event) => {
  const log = {
    timestamp: new Date().toISOString(),
    action: 'DELETE',
    filter: event.filter,
    deleted: event.deleted
  }
  appendFileSync('audit.log', JSON.stringify(log) + '\n')
})
```

### Cache Invalidation

Automatically invalidate cached data when documents change:

```typescript
const cache = new Map<string, User>()

// Populate cache on read
async function getCachedUser(id: string): Promise<User | null> {
  if (cache.has(id)) {
    return cache.get(id)!
  }
  const user = await users.findOne(id)
  if (user) {
    cache.set(id, user)
  }
  return user
}

// Invalidate cache on changes
users.on('insert', (event) => {
  cache.set(event.document._id, event.document)
})

users.on('update', (event) => {
  if (event.document) {
    cache.set(event.document._id, event.document)
  }
})

users.on('delete', (event) => {
  if (typeof event.filter === 'string') {
    cache.delete(event.filter)
  }
})

users.on('drop', () => {
  cache.clear()
})
```

### Real-Time Notifications

Send notifications when documents are created or updated:

```typescript
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 8080 })

users.on('insert', (event) => {
  const notification = {
    type: 'user.created',
    userId: event.document._id,
    name: event.document.name
  }
  
  // Broadcast to all connected clients
  wss.clients.forEach((client) => {
    client.send(JSON.stringify(notification))
  })
})

users.on('update', (event) => {
  if (!event.document) return
  
  const notification = {
    type: 'user.updated',
    userId: event.document._id,
    changes: event.update
  }
  
  wss.clients.forEach((client) => {
    client.send(JSON.stringify(notification))
  })
})
```

### Error Monitoring

Track and report database errors:

```typescript
const errorTracker = new Map<string, number>()

users.on('error', (event) => {
  const key = `${event.operation}:${event.error.name}`
  errorTracker.set(key, (errorTracker.get(key) || 0) + 1)
  
  console.error(`Database error in ${event.operation}:`, event.error.message)
  
  // Send to error tracking service
  // trackError({ operation: event.operation, error: event.error })
})

// Check error counts periodically
setInterval(() => {
  if (errorTracker.size > 0) {
    console.log('Error summary:', Object.fromEntries(errorTracker))
  }
}, 60000) // Every minute
```

## API Reference

### on()

Register an event listener that fires every time the event occurs.

```typescript
collection.on(event, listener)
```

**Parameters:**
- `event` - The event name (e.g., 'insert', 'update', 'delete')
- `listener` - Function called when the event fires

**Returns:** The collection instance (for chaining)

**Example:**
```typescript
users.on('insert', (event) => {
  console.log('New user:', event.document.name)
})
```

### once()

Register an event listener that fires only once, then is automatically removed.

```typescript
collection.once(event, listener)
```

**Parameters:**
- `event` - The event name
- `listener` - Function called when the event fires (only once)

**Returns:** The collection instance (for chaining)

**Example:**
```typescript
users.once('insert', (event) => {
  console.log('First user created:', event.document.name)
})

await users.insertOne({ name: 'Alice', email: 'alice@example.com', age: 30 })
await users.insertOne({ name: 'Bob', email: 'bob@example.com', age: 25 })
// Only logs "First user created: Alice"
```

### off()

Remove a specific event listener.

```typescript
collection.off(event, listener)
```

**Parameters:**
- `event` - The event name
- `listener` - The specific listener function to remove

**Returns:** The collection instance (for chaining)

**Example:**
```typescript
const listener = (event) => {
  console.log('User created:', event.document.name)
}

users.on('insert', listener)
await users.insertOne({ name: 'Alice', email: 'alice@example.com', age: 30 })

users.off('insert', listener)
await users.insertOne({ name: 'Bob', email: 'bob@example.com', age: 25 })
// Only logs first insert
```

### removeAllListeners()

Remove all listeners for a specific event, or all listeners for all events.

```typescript
collection.removeAllListeners(event?)
```

**Parameters:**
- `event` (optional) - The event name to clear. If omitted, removes all listeners for all events.

**Returns:** The collection instance (for chaining)

**Example:**
```typescript
// Remove all insert listeners
users.removeAllListeners('insert')

// Remove all listeners for all events
users.removeAllListeners()
```

### listenerCount()

Get the number of listeners registered for a specific event.

```typescript
collection.listenerCount(event)
```

**Parameters:**
- `event` - The event name

**Returns:** Number of listeners registered

**Example:**
```typescript
users.on('insert', listener1)
users.on('insert', listener2)

console.log(users.listenerCount('insert')) // 2
```

### listeners()

Get an array of all listener functions for a specific event.

```typescript
collection.listeners(event)
```

**Parameters:**
- `event` - The event name

**Returns:** Array of listener functions

**Example:**
```typescript
const listener1 = (event) => console.log('Listener 1:', event.document.name)
const listener2 = (event) => console.log('Listener 2:', event.document.name)

users.on('insert', listener1)
users.on('insert', listener2)

const allListeners = users.listeners('insert')
console.log(allListeners.length) // 2
console.log(allListeners.includes(listener1)) // true
```

## Type Safety

Event listeners are fully type-safe. TypeScript will infer the correct payload type for each event:

```typescript
type User = Document<{
  name: string
  email: string
  age: number
}>

const users = db.collection<User>('users', userSchema)

// TypeScript knows event.document is type User
users.on('insert', (event) => {
  const name: string = event.document.name // ✓ Type-safe
  const id: string = event.document._id     // ✓ Has _id
  // event.document.foo                     // ✗ Type error
})

// TypeScript knows update event has different shape
users.on('update', (event) => {
  const upserted: boolean = event.upserted  // ✓ Type-safe
  const doc: User | null = event.document   // ✓ May be null
  const update: Partial<User> = event.update // ✓ Partial update
})

// TypeScript knows deleteMany has deletedCount
users.on('deleteMany', (event) => {
  const count: number = event.deletedCount  // ✓ Type-safe
})
```

## Performance

Event emitters are **lazily initialized** - there is zero overhead until you register the first listener:

```typescript
// No event emitter created yet - zero overhead
const users = db.collection('users', schema)

// Event emitter created only when first listener is registered
users.on('insert', listener)

// Additional listeners reuse the same emitter
users.on('update', listener2)
```

**Key performance characteristics:**

- **Zero overhead when unused** - No emitter object or memory allocated until needed
- **Fast emission** - Event payload objects are only created if listeners exist
- **Cleanup on close** - Event listeners are automatically cleaned up when:
  - The collection is dropped (`drop()`)
  - The database is closed (`close()`)

```typescript
// Good practice: Clean up listeners when done
function setupListeners() {
  const cleanup = () => {
    users.removeAllListeners()
  }
  
  users.on('insert', handler)
  users.on('update', handler)
  
  return cleanup
}

const cleanup = setupListeners()

// Later...
cleanup() // Remove all listeners
```

## Method Chaining

Event methods return the collection instance, enabling fluent chaining:

```typescript
users
  .on('insert', (event) => console.log('Insert:', event.document.name))
  .on('update', (event) => console.log('Update:', event.document?.name))
  .on('delete', (event) => console.log('Delete:', event.deleted))

// Continue with data operations
await users.insertOne({ name: 'Alice', email: 'alice@example.com', age: 30 })
```

## Best Practices

1. **Keep listeners fast** - Event handlers block the calling code, so keep them lightweight. Offload heavy work to background queues.

```typescript
// Good - quick logging
users.on('insert', (event) => {
  console.log('User created:', event.document._id)
})

// Better - async background work
users.on('insert', (event) => {
  queueJob('send-welcome-email', { userId: event.document._id })
})
```

2. **Clean up listeners** - Remove listeners when they're no longer needed to prevent memory leaks.

```typescript
// In React/Vue components
useEffect(() => {
  const listener = (event) => console.log(event.document.name)
  users.on('insert', listener)
  
  return () => {
    users.off('insert', listener)
  }
}, [])
```

3. **Handle errors gracefully** - A failing listener is reported to `error` observers (or logged), and subsequent listeners still execute. Register an `error` listener to observe failures centrally.

```typescript
users.on('insert', (event) => {
  try {
    sendNotification(event.document)
  } catch (error) {
    console.error('Notification failed:', error)
  }
})
```

4. **Use once() for one-time setup** - If you only need to react to the first event, use `once()` instead of `on()` to avoid memory leaks.

```typescript
// Wait for first user to be created
users.once('insert', (event) => {
  console.log('Database seeded with first user')
})
```

5. **Type your listeners** - For better IDE support and type safety, explicitly type your event handlers.

```typescript
import type { InsertEvent } from 'stratadb'

const handleInsert = (event: InsertEvent<User>) => {
  console.log('User created:', event.document.name)
}

users.on('insert', handleInsert)
```

## Advanced Patterns

### Event Aggregation

Collect multiple events and process them in batches:

```typescript
const buffer: InsertEvent<User>[] = []

users.on('insert', (event) => {
  buffer.push(event)
})

// Process buffer every 5 seconds
setInterval(() => {
  if (buffer.length > 0) {
    processBatch(buffer.splice(0))
  }
}, 5000)
```

### Conditional Listeners

React to events only when certain conditions are met:

```typescript
users.on('update', (event) => {
  // Only care about age changes
  if ('age' in event.update) {
    console.log('Age updated:', event.update.age)
  }
})

users.on('insert', (event) => {
  // Only notify for admin users
  if (event.document.role === 'admin') {
    notifyAdminCreated(event.document)
  }
})
```

### Multiple Collection Coordination

Coordinate changes across multiple collections:

```typescript
const users = db.collection<User>('users', userSchema)
const posts = db.collection<Post>('posts', postSchema)

// When user is deleted, clean up their posts
users.on('delete', async (event) => {
  if (typeof event.filter === 'string') {
    await posts.deleteMany({ authorId: event.filter })
  }
})

// When post is created, update user's post count
posts.on('insert', async (event) => {
  const authorId = event.document.authorId
  const user = await users.findOne(authorId)
  if (user) {
    await users.updateOne(authorId, { 
      postCount: (user.postCount || 0) + 1 
    })
  }
})
```
