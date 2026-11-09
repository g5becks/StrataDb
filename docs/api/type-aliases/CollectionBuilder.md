[stratadb](../index.md) / CollectionBuilder

# Type Alias: CollectionBuilder&lt;T&gt;

```ts
type CollectionBuilder<T> = object;
```

Defined in: [src/collection-builder.ts:33](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-builder.ts#L33)

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

Defined in: [src/collection-builder.ts:94](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-builder.ts#L94)

Build and return the collection with the defined schema.

#### Returns

[`Collection`](Collection.md)&lt;`T`&gt;

The collection instance ready for operations

***

### cache()

```ts
cache(enabled): CollectionBuilder<T>;
```

Defined in: [src/collection-builder.ts:87](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-builder.ts#L87)

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

Defined in: [src/collection-builder.ts:52](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-builder.ts#L52)

Define a compound index spanning multiple fields.

#### Parameters

##### name

`string`

##### fields

readonly (keyof `T`)[]

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

Defined in: [src/collection-builder.ts:37](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-builder.ts#L37)

Define an indexed field with type checking.

#### Type Parameters

##### K

`K` *extends* `string` \| `number` \| `symbol`

#### Parameters

##### name

`K`

##### options

###### default?

`T`\[`K`\]

###### indexed?

`boolean`

###### nullable?

`boolean`

###### path?

[`JsonPath`](JsonPath.md)

###### type

[`TypeScriptToSQLite`](TypeScriptToSQLite.md)&lt;`T`\[`K`\]&gt;

###### unique?

`boolean`

#### Returns

`CollectionBuilder`&lt;`T`&gt;

***

### timestamps()

```ts
timestamps(enabled?): CollectionBuilder<T>;
```

Defined in: [src/collection-builder.ts:61](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-builder.ts#L61)

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

Defined in: [src/collection-builder.ts:66](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-builder.ts#L66)

Add validation function using a type predicate.

#### Parameters

##### validator

(`doc`) => `doc is T`

#### Returns

`CollectionBuilder`&lt;`T`&gt;
