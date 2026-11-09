[stratadb](../index.md) / ExistenceOperator

# Type Alias: ExistenceOperator

```ts
type ExistenceOperator = object;
```

Defined in: [src/query-types.ts:324](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/query-types.ts#L324)

Existence operators for checking field presence.

## Remarks

Allows checking whether a field exists in a document, regardless of its value.
This is useful for distinguishing between missing fields and fields with null values.

## Example

```typescript
// Check if field exists (even if null)
const hasEmail = { email: { $exists: true } };

// Check if field is missing
const noPhone = { phone: { $exists: false } };

// Combined with other operators
const activeUsersWithEmail = {
  status: 'active',
  email: { $exists: true, $ne: null }
};
```

## Properties

### $exists?

```ts
readonly $exists?: boolean;
```

Defined in: [src/query-types.ts:326](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/query-types.ts#L326)

Field exists in document (true) or doesn't exist (false)
