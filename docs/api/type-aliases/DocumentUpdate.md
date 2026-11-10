[stratadb](../index.md) / DocumentUpdate

# Type Alias: DocumentUpdate&lt;T&gt;

```ts
type DocumentUpdate<T> =
  | Simplify<PartialDeep<Except<T, "_id" | "createdAt" | "updatedAt">>> & object
  | AtomicUpdate<T>;
```

Defined in: [src/core-types.ts:163](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/core-types.ts#L163)

Document update type for update operations.

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The full document type (Document\<YourShape\>)

## Remarks

Accepts a deep merge or atomic operators. IDs and timestamp metadata are immutable.
Used for `updateOne()` and `updateMany()` operations.
Atomic operator paths support dotted fields; plain updates deep-merge objects.

## Example

```typescript
type User = Document<{
  name: string;
  email: string;
  profile: {
    bio: string;
  };
}>;

const update: DocumentUpdate<User> = {
  name: 'Alice Smith',  // Update name only
  profile: {
    bio: 'New bio'      // Partial nested update
  }
};

await users.updateOne('user-id', update);
```
