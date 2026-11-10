[stratadb](../index.md) / TimestampConfig

# Type Alias: TimestampConfig

```ts
type TimestampConfig =
  | {
  createdAt?: boolean;
  updatedAt?: boolean;
}
  | boolean;
```

Defined in: [src/schema-types.ts:207](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/schema-types.ts#L207)

Configuration for automatic timestamp management.

## Union Members

### Type Literal

```ts
{
  createdAt?: boolean;
  updatedAt?: boolean;
}
```

#### createdAt?

```ts
readonly createdAt?: boolean;
```

Whether to automatically add createdAt timestamp on document creation

#### updatedAt?

```ts
readonly updatedAt?: boolean;
```

Whether to automatically update updatedAt timestamp on document modification

***

`boolean`

## Remarks

Controls whether documents automatically receive createdAt and updatedAt timestamps
when inserted or updated. This simplifies audit trail management and is commonly
used in document databases.

## Example

```typescript
// Enable both timestamps (default behavior)
const timestamps: TimestampConfig = true;

// Explicit configuration
const timestamps: TimestampConfig = {
  createdAt: true,
  updatedAt: true
};

// Only track creation time
const timestamps: TimestampConfig = {
  createdAt: true,
  updatedAt: false
};

// Disable automatic timestamps
const timestamps: TimestampConfig = false;
```
