[stratadb](../index.md) / QueryFilter

# Type Alias: QueryFilter&lt;T&gt;

```ts
type QueryFilter<T> = Simplify<
  | LogicalOperator<T>
  | { [K in keyof T]?: T[K] | FieldOperator<T[K]> }
  | { [P in DocumentPath<T> as P extends string ? P : never]?: P extends string ? PathValue<T, P> | FieldOperator<PathValue<T, P>> : never }>;
```

Defined in: [src/query-types.ts:570](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/query-types.ts#L570)

Complete query filter combining field filters and logical operators.

## Type Parameters

### T

`T`

The document type being queried

## Remarks

QueryFilter is the root type for all database queries in StrataDB. It combines:
- Direct field matching (e.g., `{ name: 'Alice' }`)
- Field operators (e.g., `{ age: { $gt: 18 } }`)
- Logical operators (e.g., `{ $and: [...] }`)
- Nested path queries (e.g., `{ 'profile.bio': 'Software engineer' }`)

This type is fully recursive, allowing unlimited query complexity while
maintaining complete type safety at compile time. The Simplify wrapper
ensures clean IDE hover displays for complex query types.

## Example

```typescript
type User = Document<{
  name: string;
  age: number;
  email: string;
  tags: string[];
  status: 'active' | 'inactive';
  createdAt: Date;
  profile: {
    bio: string;
    settings: {
      theme: 'light' | 'dark';
    };
  };
}>;

// ✅ Simple field matching
const simpleQuery: QueryFilter<User> = {
  name: 'Alice'
};

// ✅ Field operators
const operatorQuery: QueryFilter<User> = {
  age: { $gt: 18, $lte: 65 },
  email: { $endsWith: '@example.com' }
};

// ✅ Nested path queries (dot notation)
const nestedQuery: QueryFilter<User> = {
  'profile.bio': 'Software engineer',
  'profile.settings.theme': 'dark'
};

// ✅ Nested paths with operators
const nestedOperatorQuery: QueryFilter<User> = {
  'profile.bio': { $like: '%engineer%' },
  'profile.settings.theme': { $in: ['light', 'dark'] }
};

// ✅ Logical operators
const logicalQuery: QueryFilter<User> = {
  $and: [
    { age: { $gte: 18 } },
    { status: 'active' }
  ]
};

// ✅ Mixed queries
const mixedQuery: QueryFilter<User> = {
  status: 'active',
  $or: [
    { age: { $lt: 25 } },
    { tags: { $in: ['premium', 'vip'] } }
  ]
};

// ✅ Complex nested queries
const complexQuery: QueryFilter<User> = {
  $and: [
    {
      $or: [
        { age: { $gt: 18, $lt: 65 } },
        { status: 'active' }
      ]
    },
    {
      $not: {
        email: { $endsWith: '@spam.com' }
      }
    },
    {
      tags: { $all: ['verified', 'active'] }
    },
    {
      'profile.settings.theme': 'dark'
    }
  ]
};

// ✅ Array element matching
const arrayQuery: QueryFilter<User> = {
  tags: {
    $elemMatch: {
      // This recursively uses QueryFilter for array elements
      $startsWith: 'premium'
    }
  }
};

// Usage with collection
const results = await users.find(complexQuery);
```
