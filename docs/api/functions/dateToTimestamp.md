[stratadb](../index.md) / dateToTimestamp

# Function: dateToTimestamp()

```ts
function dateToTimestamp(date): number;
```

Defined in: [src/timestamps.ts:137](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/timestamps.ts#L137)

Convert a JavaScript Date object to a StrataDB timestamp.

## Parameters

### date

`Date`

Date object to convert

## Returns

`number`

Unix timestamp in milliseconds

## Remarks

Use this when you have a Date object (from user input, external API, etc.)
that needs to be stored as a timestamp in StrataDB.

## Example

```typescript
// Store a specific date
const birthDate = new Date('1990-01-01');
await users.insertOne({
  name: 'Charlie',
  birthDate: dateToTimestamp(birthDate)
});

// Store user's selected date from form
const selectedDate = new Date(formInput.date);
await events.insertOne({
  title: 'Conference',
  eventDate: dateToTimestamp(selectedDate)
});
```
