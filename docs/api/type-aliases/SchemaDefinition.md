[stratadb](../index.md) / SchemaDefinition

# Type Alias: SchemaDefinition&lt;T&gt;

```ts
type SchemaDefinition<T> = object;
```

Defined in: [src/schema-types.ts:281](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/schema-types.ts#L281)

Complete schema definition for a document collection.

## Remarks

The SchemaDefinition type brings together all schema configuration elements
to create a complete, type-safe collection definition. It combines field definitions,
compound indexes, timestamp configuration, and optional validation logic.

This type serves as the foundation for collection creation and ensures that
all database operations maintain schema consistency and type safety throughout
the library.

## Example

```typescript
type User = Document<{
  name: string;
  email: string;
  age: number;
  profile: {
    bio: string;
    settings: {
      theme: 'light' | 'dark';
    };
  };
  createdAt: Date;
  updatedAt: Date;
}>;

const userSchema: SchemaDefinition<User> = {
  // Field definitions for indexing and constraints
  fields: [
    { name: 'name', type: 'TEXT', indexed: true },
    { name: 'email', type: 'TEXT', indexed: true, unique: true, nullable: false },
    { name: 'age', type: 'INTEGER', indexed: true },
    { name: 'profile.bio', type: 'TEXT', indexed: true },
    { name: 'profile.settings.theme', type: 'TEXT', indexed: true }
  ],

  // Compound indexes for multi-field queries
  compoundIndexes: [
    { name: 'name_age', fields: ['name', 'age'] },
    { name: 'email_status', fields: ['email', 'status'], unique: true }
  ],

  // Automatic timestamp management
  timestamps: {
    createdAt: true,
    updatedAt: true
  },

  // Optional validation using Standard Schema
  validate: (doc: unknown): doc is User => {
    return typeof doc === 'object' && doc !== null &&
           'name' in doc && typeof doc.name === 'string' &&
           'email' in doc && typeof doc.email === 'string';
  }
};

// Usage with collection
const users = db.collection('users', userSchema);
```

## Type Parameters

### T

`T`

The document type this schema defines

## Properties

### compoundIndexes?

```ts
readonly compoundIndexes?: readonly CompoundIndex<T>[];
```

Defined in: [src/schema-types.ts:286](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/schema-types.ts#L286)

Array of compound index definitions for multi-field queries

***

### fields

```ts
readonly fields: readonly SchemaField<T, keyof T>[];
```

Defined in: [src/schema-types.ts:283](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/schema-types.ts#L283)

Array of field definitions for indexing and constraints

***

### timestamps?

```ts
readonly timestamps?: TimestampConfig;
```

Defined in: [src/schema-types.ts:289](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/schema-types.ts#L289)

Configuration for automatic timestamp management

***

### validate?

```ts
readonly validate?: (doc) => doc is T;
```

Defined in: [src/schema-types.ts:292](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/schema-types.ts#L292)

Optional validation function using Standard Schema type predicate signature

#### Parameters

##### doc

`unknown`

#### Returns

`doc is T`
