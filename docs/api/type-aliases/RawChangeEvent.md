[stratadb](../index.md) / RawChangeEvent

# Type Alias: RawChangeEvent

```ts
type RawChangeEvent = object;
```

Defined in: [src/raw-changes.ts:5](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/raw-changes.ts#L5)

Connection-local row notification; it can describe a later rolled-back change.

## Properties

### operation

```ts
readonly operation: "insert" | "update" | "delete";
```

Defined in: [src/raw-changes.ts:6](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/raw-changes.ts#L6)

***

### rowid

```ts
readonly rowid: number | bigint;
```

Defined in: [src/raw-changes.ts:9](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/raw-changes.ts#L9)

***

### schema

```ts
readonly schema: string;
```

Defined in: [src/raw-changes.ts:8](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/raw-changes.ts#L8)

***

### table

```ts
readonly table: string;
```

Defined in: [src/raw-changes.ts:7](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/raw-changes.ts#L7)
