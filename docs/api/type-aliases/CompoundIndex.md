[stratadb](../index.md) / CompoundIndex

# Type Alias: CompoundIndex&lt;T&gt;

```ts
type CompoundIndex<T> = object;
```

Defined in: [src/schema-types.ts:167](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/schema-types.ts#L167)

Compound index definition for multi-field indexes.

## Remarks

Compound indexes improve query performance when filtering by multiple fields together.
The order of fields matters - queries must use fields from left to right for the index to be effective.

## Example

```typescript
// Define compound index on age and status
.compoundIndex('age_status', ['age', 'status'])

// Queries that can use this index:
{ age: 30, status: 'active' }           // Uses index fully
{ age: { $gte: 25 } }                   // Uses index partially (age only)

// Queries that CANNOT use this index:
{ status: 'active' }                    // Doesn't start with first field (age)

// Unique compound constraint
.compoundIndex('email_tenant', ['email', 'tenantId'], { unique: true })
```

## Type Parameters

### T

`T`

The document type

## Properties

### fields

```ts
readonly fields: ReadonlyArray<keyof T>;
```

Defined in: [src/schema-types.ts:172](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/schema-types.ts#L172)

Array of field names to include in the index (order matters)

***

### name

```ts
readonly name: string;
```

Defined in: [src/schema-types.ts:169](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/schema-types.ts#L169)

Unique name for the index (e.g., 'age_status', 'email_tenant')

***

### unique?

```ts
readonly unique?: boolean;
```

Defined in: [src/schema-types.ts:175](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/schema-types.ts#L175)

Whether to enforce uniqueness across the combination of fields
