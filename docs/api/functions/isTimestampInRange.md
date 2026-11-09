[stratadb](../index.md) / isTimestampInRange

# Function: isTimestampInRange()

```ts
function isTimestampInRange(
   timestamp,
   start,
   end
): boolean;
```

Defined in: [src/timestamps.ts:171](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/timestamps.ts#L171)

Check if a timestamp is within a given time range.

## Parameters

### timestamp

`number`

The timestamp to check

### start

`number`

Start of the range (inclusive)

### end

`number`

End of the range (inclusive)

## Returns

`boolean`

True if timestamp is within range

## Remarks

Useful for filtering documents by time ranges without converting to Date objects.
All comparisons are done with numbers for maximum performance.

## Example

```typescript
// Find users created in the last 30 days
const thirtyDaysAgo = nowTimestamp() - (30 * 24 * 60 * 60 * 1000);
const now = nowTimestamp();

const recentUsers = await users.find({
  // Using query operators (preferred)
  createdAt: { $gte: thirtyDaysAgo, $lte: now }
});

// Or filter in memory if needed
const allUsers = await users.find({});
const filtered = allUsers.filter(u =>
  isTimestampInRange(u.createdAt, thirtyDaysAgo, now)
);
```
