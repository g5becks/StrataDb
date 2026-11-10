[stratadb](../index.md) / CollectionAdminContract

# Type Alias: CollectionAdminContract&lt;T&gt;

```ts
type CollectionAdminContract<T> = object;
```

Defined in: [src/collection-contract-admin.ts:4](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-contract-admin.ts#L4)

Admin members of [Collection](Collection.md).

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

## Methods

### drop()

```ts
drop(options?): Promise<void>;
```

Defined in: [src/collection-contract-admin.ts:32](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-contract-admin.ts#L32)

Drop the collection (delete the table).

#### Parameters

##### options?

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`void`&gt;

Promise resolving when the collection is dropped

#### Remarks

Permanently deletes the collection and all its documents.
This operation cannot be undone.

The table and all associated indexes are removed from the database.
Use with caution in production environments.

#### Example

```typescript
// Drop a temporary collection
await tempCollection.drop();

// Drop with confirmation
if (confirm('Really delete all users?')) {
  await users.drop();
}

// With abort signal
const controller = new AbortController();
await collection.drop({ signal: controller.signal });
```

***

### validate()

```ts
validate(doc, options?): Promise<T>;
```

Defined in: [src/collection-contract-admin.ts:73](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-contract-admin.ts#L73)

Validate a document against the schema (async).

#### Parameters

##### doc

`unknown`

Document to validate

##### options?

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`T`&gt;

Promise resolving to true if valid

#### Remarks

Validates the document against the schema validator.
Supports both synchronous and asynchronous validators.
Throws `ValidationError` if validation fails.

#### Throws

If document fails validation

#### Example

```typescript
try {
  await users.validate({
    name: 'Alice',
    email: 'invalid-email',
    age: -5,
    role: 'admin'
  });
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(`Invalid field: ${err.field}`);
    console.error(`Error: ${err.message}`);
  }
}

// With abort signal
const controller = new AbortController();
await users.validate(doc, { signal: controller.signal });
```

***

### validateSync()

```ts
validateSync(doc): T;
```

Defined in: [src/collection-contract-admin.ts:101](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-contract-admin.ts#L101)

Validate a document against the schema (sync).

#### Parameters

##### doc

`unknown`

Document to validate

#### Returns

`T`

True if valid

#### Remarks

Synchronous version of `validate()`. Only works with synchronous validators.
Throws error if the schema uses async validators.

#### Throws

If document fails validation

#### Throws

If schema uses async validators

#### Example

```typescript
try {
  users.validateSync({ name: 'Alice', email: 'alice@example.com', age: 30, role: 'admin' });
  console.log('Document is valid');
} catch (err) {
  console.error('Validation failed:', err.message);
}
```
