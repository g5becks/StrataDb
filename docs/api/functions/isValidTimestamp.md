[stratadb](../index.md) / isValidTimestamp

# Function: isValidTimestamp()

```ts
function isValidTimestamp(value): value is number;
```

Defined in: [src/timestamps.ts:233](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/timestamps.ts#L233)

Type guard to check if a value is a valid timestamp.

## Parameters

### value

`unknown`

Value to check

## Returns

`value is number`

True if value is a valid timestamp number

## Remarks

A valid timestamp is a positive number that represents a reasonable date.
This function checks if the value is a number and falls within a plausible
range (after 1970 and before year 3000).

## Example

```typescript
const input: unknown = getUserInput();

if (isValidTimestamp(input)) {
  // TypeScript now knows input is a number
  const date = timestampToDate(input);
  console.log(date.toISOString());
} else {
  throw new Error('Invalid timestamp provided');
}
```
