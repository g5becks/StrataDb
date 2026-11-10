[stratadb](../index.md) / CollectionEventsContract

# Type Alias: CollectionEventsContract&lt;T&gt;

```ts
type CollectionEventsContract<T> = object;
```

Defined in: [src/collection-contract-events.ts:8](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/collection-contract-events.ts#L8)

Events members of [Collection](Collection.md).

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

## Methods

### listenerCount()

```ts
listenerCount(event): number;
```

Defined in: [src/collection-contract-events.ts:195](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/collection-contract-events.ts#L195)

Get the number of listeners for an event.

#### Parameters

##### event

keyof [`CollectionEventMap`](CollectionEventMap.md)&lt;[`Document`](Document.md)&gt;

The event name

#### Returns

`number`

Number of registered listeners for the event

#### Remarks

Returns the count of listeners currently registered for the specified event.
Useful for debugging or monitoring event listener usage.

Returns 0 if no listeners are registered or if the event emitter
has not been initialized yet.

#### Example

```typescript
// Check if anyone is listening
if (users.listenerCount('insert') === 0) {
  console.log('No insert listeners registered')
}

// Monitor listener count
users.on('insert', listener1)
users.on('insert', listener2)
console.log(users.listenerCount('insert')) // 2

users.off('insert', listener1)
console.log(users.listenerCount('insert')) // 1
```

***

### listeners()

```ts
listeners<E>(event): ((...args) => void)[];
```

Defined in: [src/collection-contract-events.ts:227](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/collection-contract-events.ts#L227)

Get all listeners for an event.

#### Type Parameters

##### E

`E` *extends* keyof [`CollectionEventMap`](CollectionEventMap.md)&lt;[`Document`](Document.md)&gt;

The event name type

#### Parameters

##### event

`E`

The event name

#### Returns

((...`args`) => `void`)[]

Array of listener functions registered for the event

#### Remarks

Returns an array of all listener functions currently registered for
the specified event. The array is a copy, so modifying it won't affect
the actual listeners.

Returns an empty array if no listeners are registered or if the event
emitter has not been initialized yet.

#### Example

```typescript
// Get all insert listeners
const insertListeners = users.listeners('insert')
console.log(`${insertListeners.length} listeners registered`)

// Iterate over listeners
for (const listener of users.listeners('update')) {
  console.log('Listener:', listener.name)
}

// Check if specific listener is registered
const hasListener = users.listeners('delete').includes(myListener)
```

***

### off()

```ts
off<E>(event, listener): Collection<T>;
```

Defined in: [src/collection-contract-events.ts:131](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/collection-contract-events.ts#L131)

Remove an event listener.

#### Type Parameters

##### E

`E` *extends* keyof [`CollectionEventMap`](CollectionEventMap.md)&lt;[`Document`](Document.md)&gt;

The event name type

#### Parameters

##### event

`E`

The event name

##### listener

(...`args`) => `void`

The callback function to remove

#### Returns

[`Collection`](Collection.md)&lt;`T`&gt;

The collection instance for method chaining

#### Remarks

Removes a previously registered listener. The listener reference must
be the same function reference that was passed to `on()` or `once()`.

If the listener was not registered, this method has no effect.

#### Example

```typescript
// Define listener function
const logInsert = (event: InsertEvent<User>) => {
  console.log('User inserted:', event.document._id)
}

// Register listener
users.on('insert', logInsert)

// Later, remove it
users.off('insert', logInsert)

// Note: Arrow functions must use the same reference
const listener = (event) => console.log(event)
users.on('insert', listener)
users.off('insert', listener) // Works

// This won't work (different function reference):
users.on('insert', (event) => console.log(event))
users.off('insert', (event) => console.log(event)) // Does nothing
```

***

### on()

```ts
on<E>(event, listener): Collection<T>;
```

Defined in: [src/collection-contract-events.ts:59](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/collection-contract-events.ts#L59)

Register an event listener for collection events.

#### Type Parameters

##### E

`E` *extends* keyof [`CollectionEventMap`](CollectionEventMap.md)&lt;[`Document`](Document.md)&gt;

The event name type

#### Parameters

##### event

`E`

The event name to listen for

##### listener

(...`args`) => `void`

The callback function to invoke when the event is emitted

#### Returns

[`Collection`](Collection.md)&lt;`T`&gt;

The collection instance for method chaining

#### Remarks

Registers a listener function that will be called whenever the specified
event is emitted. The listener receives the event payload as its argument.

The event emitter is lazily initialized on the first call to `on()`,
ensuring zero overhead when events are not used.

All events are emitted **after** the operation completes successfully.
Events do not fire if the operation throws an error (except for 'error' events).

#### Example

```typescript
// Audit logging
users.on('insert', (event) => {
  console.log(`New user created: ${event.document._id}`)
  auditLog.record('user.created', event.document)
})

// Cache invalidation
users.on('update', (event) => {
  if (event.document) {
    cache.invalidate(`user:${event.document._id}`)
  }
})

// Error monitoring
users.on('error', (event) => {
  errorTracker.capture(event.error, {
    operation: event.operation,
    context: event.context
  })
})

// Method chaining
users
  .on('insert', logInsert)
  .on('update', logUpdate)
  .on('delete', logDelete)
```

***

### once()

```ts
once<E>(event, listener): Collection<T>;
```

Defined in: [src/collection-contract-events.ts:89](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/collection-contract-events.ts#L89)

Register a one-time event listener.

#### Type Parameters

##### E

`E` *extends* keyof [`CollectionEventMap`](CollectionEventMap.md)&lt;[`Document`](Document.md)&gt;

The event name type

#### Parameters

##### event

`E`

The event name to listen for

##### listener

(...`args`) => `void`

The callback function to invoke once

#### Returns

[`Collection`](Collection.md)&lt;`T`&gt;

The collection instance for method chaining

#### Remarks

Registers a listener that will be automatically removed after it is
invoked once. Useful for setup tasks or one-time notifications.

#### Example

```typescript
// Log only the first user creation
users.once('insert', (event) => {
  console.log('First user created:', event.document._id)
})

// One-time initialization
users.once('insert', async (event) => {
  await initializeUserMetrics()
})
```

***

### removeAllListeners()

```ts
removeAllListeners(event?): Collection<T>;
```

Defined in: [src/collection-contract-events.ts:164](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/collection-contract-events.ts#L164)

Remove all listeners for an event, or all events if no event specified.

#### Parameters

##### event?

keyof CollectionEventMap\<Document\>

Optional event name to clear listeners for

#### Returns

[`Collection`](Collection.md)&lt;`T`&gt;

The collection instance for method chaining

#### Remarks

If an event name is provided, removes all listeners for that event.
If no event name is provided, removes all listeners for all events.

Use with caution in shared codebases where multiple parts of the
application might be listening to the same events.

#### Example

```typescript
// Remove all 'insert' listeners
users.removeAllListeners('insert')

// Remove all listeners for all events
users.removeAllListeners()

// Cleanup before disposal
function cleanup() {
  users.removeAllListeners()
  db.close()
}
```
