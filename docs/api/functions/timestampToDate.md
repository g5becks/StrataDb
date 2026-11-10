[stratadb](../index.md) / timestampToDate

# Function: timestampToDate()

```ts
function timestampToDate(timestamp): Date;
```

Defined in: [src/timestamps.ts:106](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/timestamps.ts#L106)

Convert a StrataDB timestamp to a JavaScript Date object.

## Parameters

### timestamp

`number`

Unix timestamp in milliseconds

## Returns

`Date`

Date object representing the timestamp

## Remarks

Use this when you need to work with JavaScript Date APIs for formatting,
timezone conversion, or date arithmetic.

**Note:** Date objects are mutable and timezone-dependent. For storage
and comparison, prefer working with raw timestamps.

## Example

```typescript
const user = await users.findById('user-id');
if (user) {
  const createdDate = timestampToDate(user.createdAt);

  // Format for display
  console.log(createdDate.toLocaleDateString());
  console.log(createdDate.toISOString());

  // Date arithmetic
  const daysSinceCreation = Math.floor(
    (Date.now() - user.createdAt) / (1000 * 60 * 60 * 24)
  );
}
```
