[stratadb](../index.md) / timestampDiff

# Function: timestampDiff()

```ts
function timestampDiff(timestamp1, timestamp2): number;
```

Defined in: [src/timestamps.ts:205](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/timestamps.ts#L205)

Calculate the difference between two timestamps in milliseconds.

## Parameters

### timestamp1

`number`

First timestamp

### timestamp2

`number`

Second timestamp

## Returns

`number`

Absolute difference in milliseconds

## Remarks

Returns the absolute difference, so order doesn't matter.
Useful for calculating durations, age, time since events, etc.

## Example

```typescript
const user = await users.findById('user-id');
if (user) {
  // How long ago was the user created?
  const ageMs = timestampDiff(nowTimestamp(), user.createdAt);
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  console.log(`Account is ${ageDays} days old`);

  // Time between creation and last update
  const timeSinceUpdate = timestampDiff(user.createdAt, user.updatedAt);
  const hoursSinceUpdate = Math.floor(timeSinceUpdate / (1000 * 60 * 60));
}
```
