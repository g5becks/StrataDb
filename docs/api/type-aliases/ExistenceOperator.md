[stratadb](../index.md) / ExistenceOperator

# Type Alias: ExistenceOperator

```ts
type ExistenceOperator = object;
```

Defined in: [src/query-types.ts:328](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-types.ts#L328)

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

Defined in: [src/query-types.ts:330](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-types.ts#L330)

Field exists in document (true) or doesn't exist (false)
