[stratadb](../index.md) / CollectionBuilder

# Type Alias: CollectionBuilder&lt;T&gt;

```ts
type CollectionBuilder<T> = object;
```

Defined in: [src/collection-builder.ts:33](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-builder.ts#L33)

Fluent builder for creating collections with inline schema definition.

## Remarks

CollectionBuilder provides a fluent API for defining collection schemas inline
while creating the collection. This is an alternative to using createSchema()
separately.

## Example

```typescript
// Fluent collection creation
const users = db.collection<User>('users')
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .timestamps(true)
  .build();
```

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type extending Document

## Methods

### build()

```ts
build(): Collection<T>;
```

Defined in: [src/collection-builder.ts:107](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-builder.ts#L107)

Build and return the collection with the defined schema.

#### Returns

[`Collection`](Collection.md)&lt;`T`&gt;

The collection instance ready for operations

***

### cache()

```ts
cache(enabled): CollectionBuilder<T>;
```

Defined in: [src/collection-builder.ts:100](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-builder.ts#L100)

Enable or disable query caching for this collection.

#### Parameters

##### enabled

`boolean`

Whether to enable query caching

#### Returns

`CollectionBuilder`&lt;`T`&gt;

The builder for method chaining

#### Remarks

Query caching stores SQL templates for repeated queries, improving performance
at the cost of memory usage (up to 500 cached query templates).

#### Example

```typescript
// Enable caching for this collection
const users = db.collection<User>('users')
  .field('name', { type: 'TEXT', indexed: true })
  .cache(true)
  .build();
```

***

### compoundIndex()

```ts
compoundIndex(
   name,
   fields,
   options?
): CollectionBuilder<T>;
```

Defined in: [src/collection-builder.ts:58](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-builder.ts#L58)

Define a compound index spanning multiple fields.

#### Parameters

##### name

`string`

##### fields

readonly [`SchemaFieldName`](SchemaFieldName.md)&lt;`T`&gt;[]

##### options?

###### unique?

`boolean`

#### Returns

`CollectionBuilder`&lt;`T`&gt;

***

### compoundIndexUnchecked()

```ts
compoundIndexUnchecked(
   name,
   fields,
   options?
): CollectionBuilder<T>;
```

Defined in: [src/collection-builder.ts:65](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-builder.ts#L65)

Explicit escape hatch for dynamic compound-index field names.

#### Parameters

##### name

`string`

##### fields

readonly `string`[]

##### options?

###### unique?

`boolean`

#### Returns

`CollectionBuilder`&lt;`T`&gt;

***

### field()

```ts
field<K>(name, options): CollectionBuilder<T>;
```

Defined in: [src/collection-builder.ts:37](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-builder.ts#L37)

Define an indexed field with type checking.

#### Type Parameters

##### K

`K` *extends* `string`

#### Parameters

##### name

`K`

##### options

###### default?

`K` *extends* keyof `T` ? `T`\[`K`\] : `unknown`

###### indexed?

`boolean`

###### nullable?

`boolean`

###### path?

[`JsonPath`](JsonPath.md)

###### type

`K` *extends* keyof `T` ? [`TypeScriptToSQLite`](TypeScriptToSQLite.md)&lt;`T`\[`K`\]&gt; : [`SQLiteType`](SQLiteType.md)

###### unique?

`boolean`

#### Returns

`CollectionBuilder`&lt;`T`&gt;

***

### fieldUnchecked()

```ts
fieldUnchecked(name, options): CollectionBuilder<T>;
```

Defined in: [src/collection-builder.ts:50](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-builder.ts#L50)

Declare dynamic names with runtime identifier validation on build.

#### Parameters

##### name

`string`

##### options

[`FieldDefinitionOptions`](FieldDefinitionOptions.md)

#### Returns

`CollectionBuilder`&lt;`T`&gt;

***

### timestamps()

```ts
timestamps(enabled?): CollectionBuilder<T>;
```

Defined in: [src/collection-builder.ts:74](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-builder.ts#L74)

Enable automatic timestamp management.

#### Parameters

##### enabled?

`boolean`

#### Returns

`CollectionBuilder`&lt;`T`&gt;

***

### validate()

```ts
validate(validator): CollectionBuilder<T>;
```

Defined in: [src/collection-builder.ts:79](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-builder.ts#L79)

Add validation function using a type predicate.

#### Parameters

##### validator

(`doc`) => `doc is T`

#### Returns

`CollectionBuilder`&lt;`T`&gt;
