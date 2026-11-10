[stratadb](../index.md) / ExistenceOperator

# Type Alias: ExistenceOperator

```ts
type ExistenceOperator = object;
```

Defined in: [src/query-types.ts:321](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/query-types.ts#L321)

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

Defined in: [src/query-types.ts:323](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/query-types.ts#L323)

Field exists in document (true) or doesn't exist (false)
