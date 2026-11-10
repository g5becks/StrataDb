[stratadb](../index.md) / CollectionReadContract

# Type Alias: CollectionReadContract&lt;T&gt;

```ts
type CollectionReadContract<T> = object;
```

Defined in: [src/collection-contract-read.ts:11](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L11)

Read members of [Collection](Collection.md).

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

## Properties

### name

```ts
readonly name: string;
```

Defined in: [src/collection-contract-read.ts:15](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L15)

Collection name (table name in SQLite).

***

### schema

```ts
readonly schema: SchemaDefinition<T>;
```

Defined in: [src/collection-contract-read.ts:20](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L20)

Schema definition for this collection.

## Methods

### count()

```ts
count(filter, options?): Promise<number>;
```

Defined in: [src/collection-contract-read.ts:198](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L198)

Count documents matching the query filter.

#### Parameters

##### filter

[`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Query filter to match documents

##### options?

Optional options including signal for cancellation

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`number`&gt;

Promise resolving to the count of matching documents

#### Remarks

More efficient than `find(filter).length` since it only counts without
retrieving document data.

#### Example

```typescript
// Count all users
const total = await users.count({});

// Count active admins
const adminCount = await users.count({
  role: 'admin',
  status: 'active'
});

// Count adults
const adultCount = await users.count({ age: { $gte: 18 } });

// With abort signal
const controller = new AbortController();
const count = await users.count({}, { signal: controller.signal });
```

***

### distinct()

```ts
distinct<K>(
   field,
   filter?,
   options?
): Promise<T[K][]>;
```

Defined in: [src/collection-contract-read.ts:320](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L320)

Find distinct values for a specified field across the collection.

#### Type Parameters

##### K

`K` *extends* `string` \| `number` \| `symbol`

#### Parameters

##### field

`K`

The field name to get distinct values for

##### filter?

[`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Optional query filter to narrow results

##### options?

Optional options including signal for cancellation

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`T`\[`K`\][]&gt;

Promise resolving to array of unique values for the field

#### Remarks

Returns an array of unique values for the specified field.
If a filter is provided, only documents matching the filter are considered.

The method uses SQLite's DISTINCT clause for efficient querying.
For indexed fields, uses the generated column; for non-indexed fields, uses JSON extraction.

#### Example

```typescript
// Get all unique ages
const ages = await users.distinct('age');
console.log(ages); // [25, 30, 35, 40]

// Get unique roles for active users
const activeRoles = await users.distinct('role', { active: true });

// Get unique tags (array field)
const tags = await users.distinct('tags');

// With abort signal
const controller = new AbortController();
const ages = await users.distinct('age', {}, { signal: controller.signal });
```

***

### estimatedDocumentCount()

```ts
estimatedDocumentCount(options?): Promise<number>;
```

Defined in: [src/collection-contract-read.ts:353](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L353)

Get an estimated count of documents in the collection.

#### Parameters

##### options?

Optional options including signal for cancellation

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`number`&gt;

Promise resolving to the estimated document count

#### Remarks

Returns a fast estimate of the document count using SQLite table statistics.
This is much faster than count() for large collections but may not be exact.

Uses SQLite's internal statistics which are updated periodically.
For exact counts, use the count() method instead.

#### Example

```typescript
const estimate = await users.estimatedDocumentCount();
console.log(`Approximately ${estimate} users`);

// Compare with exact count
const exact = await users.count({});
console.log(`Exact: ${exact}, Estimated: ${estimate}`);

// With abort signal
const controller = new AbortController();
const estimate = await users.estimatedDocumentCount({ signal: controller.signal });
```

***

### find()

#### Call Signature

```ts
find<K>(filter, options): Promise<readonly Pick<T, K | keyof T & "_id">[]>;
```

Defined in: [src/collection-contract-read.ts:97](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L97)

Find all documents matching the query filter.

##### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

##### Parameters

###### filter

[`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Query filter to match documents

###### options

[`QueryOptionsWithSelect`](QueryOptionsWithSelect.md)&lt;`T`, `K`&gt;

Query options for sorting, pagination, and projection

##### Returns

`Promise`&lt;readonly `Pick`&lt;`T`, `K` \| keyof `T` & `"_id"`&gt;[]&gt;

Promise resolving to array of matching documents

##### Remarks

Returns all documents that match the filter. For large result sets,
use `limit` and `skip` options for pagination.

**Performance:**
- Indexed fields use generated columns (fast)
- Non-indexed fields use jsonb_extract (slower)
- Consider adding indexes for frequently queried fields

##### Example

```typescript
// Find all active admins
const admins = await users.find({
  role: 'admin',
  status: 'active'
});

// Find with sorting and pagination
const page = await users.find(
  { age: { $gte: 18 } },
  { sort: { createdAt: -1 }, limit: 20, skip: 40 }
);

// Find with complex query
const results = await users.find({
  $and: [
    { age: { $gte: 18, $lt: 65 } },
    {
      $or: [
        { role: 'admin' },
        { verified: true }
      ]
    }
  ]
});
```

#### Call Signature

```ts
find<K>(filter, options): Promise<readonly Omit<T, K>[]>;
```

Defined in: [src/collection-contract-read.ts:103](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L103)

##### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

##### Parameters

###### filter

[`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

###### options

[`QueryOptionsWithOmit`](QueryOptionsWithOmit.md)&lt;`T`, `K`&gt;

##### Returns

`Promise`&lt;readonly `Omit`&lt;`T`, `K`&gt;[]&gt;

#### Call Signature

```ts
find(filter, options?): Promise<readonly T[]>;
```

Defined in: [src/collection-contract-read.ts:109](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L109)

##### Parameters

###### filter

[`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

###### options?

[`QueryOptions`](QueryOptions.md)&lt;`T`&gt;

##### Returns

`Promise`&lt;readonly `T`[]&gt;

***

### findById()

```ts
findById(id, options?): Promise<T | null>;
```

Defined in: [src/collection-contract-read.ts:47](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L47)

Find a single document by its ID.

#### Parameters

##### id

`string`

The document ID to search for

##### options?

Optional options including signal for cancellation

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`T` \| `null`&gt;

Promise resolving to the document, or null if not found

#### Remarks

This is the fastest way to retrieve a specific document since it uses
the primary key index.

#### Example

```typescript
const user = await users.findById('123e4567-e89b-12d3-a456-426614174000');
if (user) {
  console.log(user.name);
}

// With abort signal
const controller = new AbortController();
const user = await users.findById(id, { signal: controller.signal });
```

***

### findOne()

#### Call Signature

```ts
findOne<K>(filter, options): Promise<Pick<T, keyof T & "_id" | K> | null>;
```

Defined in: [src/collection-contract-read.ts:151](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L151)

Find the first document matching the query filter or ID.

##### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

##### Parameters

###### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Document ID or query filter to match documents

###### options

`Omit`&lt;[`QueryOptionsWithSelect`](QueryOptionsWithSelect.md)&lt;`T`, `K`&gt;, `"limit"` \| `"skip"`&gt;

Query options for sorting and projection

##### Returns

`Promise`&lt;`Pick`&lt;`T`, keyof `T` & `"_id"` \| `K`&gt; \| `null`&gt;

Promise resolving to the first matching document, or null if none found

##### Remarks

Equivalent to `find(filter, { ...options, limit: 1 })[0]` but more efficient
since it stops after finding the first match.

Accepts either a string ID or a full QueryFilter object for flexible querying:
- String ID: `{ _id: string }` filter is applied automatically
- QueryFilter: Full MongoDB-style query filtering

##### Example

```typescript
// Find by document ID
const user = await users.findOne('123e4567-e89b-12d3-a456-426614174000');
if (user) {
  console.log(user.name);
}

// Find by query filter
const admin = await users.findOne({ role: 'admin' });

// Find with options
const latest = await users.findOne(
  {},
  { sort: { createdAt: -1 } }
);

// Check if email exists
const exists = await users.findOne({ email: 'alice@example.com' });
if (exists) {
  console.log('Email already registered');
}
```

#### Call Signature

```ts
findOne<K>(filter, options): Promise<Omit<T, K> | null>;
```

Defined in: [src/collection-contract-read.ts:157](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L157)

##### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

##### Parameters

###### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

###### options

`Omit`&lt;[`QueryOptionsWithOmit`](QueryOptionsWithOmit.md)&lt;`T`, `K`&gt;, `"limit"` \| `"skip"`&gt;

##### Returns

`Promise`&lt;`Omit`&lt;`T`, `K`&gt; \| `null`&gt;

#### Call Signature

```ts
findOne(filter, options?): Promise<T | null>;
```

Defined in: [src/collection-contract-read.ts:163](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L163)

##### Parameters

###### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

###### options?

`Omit`&lt;[`QueryOptions`](QueryOptions.md)&lt;`T`&gt;, `"limit"` \| `"skip"`&gt;

##### Returns

`Promise`&lt;`T` \| `null`&gt;

***

### search()

#### Call Signature

```ts
search<K>(
   text,
   fields,
   options
): Promise<readonly Pick<T, keyof T & "_id" | K>[]>;
```

Defined in: [src/collection-contract-read.ts:257](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L257)

Search for documents across multiple fields.

##### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

##### Parameters

###### text

`string`

The search text to find

###### fields

readonly (`string` \| keyof `T`)[]

Array of field names to search within

###### options

`Omit`&lt;[`QueryOptionsWithSelect`](QueryOptionsWithSelect.md)&lt;`T`, `K`&gt;, `"search"`&gt; & `object`

Optional query options (filter, sort, limit, projection, etc.)

##### Returns

`Promise`&lt;readonly `Pick`&lt;`T`, keyof `T` & `"_id"` \| `K`&gt;[]&gt;

Promise resolving to array of matching documents

##### Remarks

Performs case-insensitive text search across the specified fields using
SQL LIKE patterns. A document matches if the search text appears in ANY
of the specified fields.

**Search behavior:**
- Case-insensitive by default
- Matches partial strings (e.g., "script" matches "TypeScript")
- Uses OR logic across fields (match in any field returns the document)

**Performance:**
- Indexed fields use generated columns for faster matching
- Non-indexed fields use JSON extraction (slower for large datasets)
- Consider indexing frequently searched fields

**Comparison to find() with search option:**
- `search()` is cleaner when text search is the primary operation
- `find()` with `search` option is better when combining with complex filters

##### Example

```typescript
// Search for "typescript" in title and content
const articles = await posts.search('typescript', ['title', 'content']);

// Search with additional filtering
const results = await posts.search('react', ['title', 'content'], {
  filter: { category: 'programming' },
  sort: { createdAt: -1 },
  limit: 10
});

// Search in nested fields
const docs = await articles.search('hooks', ['title', 'metadata.keywords']);

// Search with projection
const titles = await posts.search('javascript', ['title', 'content'], {
  select: ['title', 'author']
});

// Case-sensitive search
const exact = await posts.search('TypeScript', ['title'], {
  caseSensitive: true
});
```

#### Call Signature

```ts
search<K>(
   text,
   fields,
   options
): Promise<readonly Omit<T, K>[]>;
```

Defined in: [src/collection-contract-read.ts:267](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L267)

##### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

##### Parameters

###### text

`string`

###### fields

readonly (`string` \| keyof `T`)[]

###### options

`Omit`&lt;[`QueryOptionsWithOmit`](QueryOptionsWithOmit.md)&lt;`T`, `K`&gt;, `"search"`&gt; & `object`

##### Returns

`Promise`&lt;readonly `Omit`&lt;`T`, `K`&gt;[]&gt;

#### Call Signature

```ts
search(
   text,
   fields,
   options?
): Promise<readonly T[]>;
```

Defined in: [src/collection-contract-read.ts:277](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-read.ts#L277)

##### Parameters

###### text

`string`

###### fields

readonly (`string` \| keyof `T`)[]

###### options?

`Omit`&lt;[`QueryOptions`](QueryOptions.md)&lt;`T`&gt;, `"search"`&gt; & `object`

##### Returns

`Promise`&lt;readonly `T`[]&gt;
