[stratadb](../index.md) / nowTimestamp

# Function: nowTimestamp()

```ts
function nowTimestamp(): number;
```

Defined in: [src/timestamps.ts:72](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/timestamps.ts#L72)

Get the current timestamp in milliseconds since Unix epoch.

## Returns

`number`

Current timestamp as number (Unix time in milliseconds)

## Remarks

This is the standard timestamp format used throughout StrataDB.
Equivalent to `Date.now()` but provided as a named function for clarity.

**Why milliseconds?**
- JavaScript Date uses milliseconds as standard
- Provides sufficient precision for most applications
- Smaller storage footprint than nanoseconds
- Compatible with SQLite INTEGER type

## Example

```typescript
const now = nowTimestamp();
console.log(now); // 1700000000000

// Can be used for manual timestamp fields
await users.insertOne({
  name: 'Bob',
  lastLoginAt: nowTimestamp()
});
```
