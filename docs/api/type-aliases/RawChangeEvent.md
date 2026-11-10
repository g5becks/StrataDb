[stratadb](../index.md) / RawChangeEvent

# Type Alias: RawChangeEvent

```ts
type RawChangeEvent = object;
```

Defined in: [src/raw-changes.ts:5](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/raw-changes.ts#L5)

Connection-local row notification; it can describe a later rolled-back change.

## Properties

### operation

```ts
readonly operation: "insert" | "update" | "delete";
```

Defined in: [src/raw-changes.ts:6](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/raw-changes.ts#L6)

***

### rowid

```ts
readonly rowid: number | bigint;
```

Defined in: [src/raw-changes.ts:9](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/raw-changes.ts#L9)

***

### schema

```ts
readonly schema: string;
```

Defined in: [src/raw-changes.ts:8](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/raw-changes.ts#L8)

***

### table

```ts
readonly table: string;
```

Defined in: [src/raw-changes.ts:7](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/raw-changes.ts#L7)
