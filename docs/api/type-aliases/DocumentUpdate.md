[stratadb](../index.md) / DocumentUpdate

# Type Alias: DocumentUpdate&lt;T&gt;

```ts
type DocumentUpdate<T> = Simplify<PartialDeep<Except<T, "_id">>>;
```

Defined in: [src/core-types.ts:127](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/core-types.ts#L127)

Document update type for update operations.

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The full document type (Document\<YourShape\>)

## Remarks

All fields are optional (deep partial) except for the ID which cannot be updated.
Used for `updateOne()` and `updateMany()` operations.
Supports nested updates using dot notation.

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
