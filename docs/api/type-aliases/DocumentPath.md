[stratadb](../index.md) / DocumentPath

# Type Alias: DocumentPath&lt;T&gt;

```ts
type DocumentPath<T> = Paths<T>;
```

Defined in: [src/path-types.ts:46](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/path-types.ts#L46)

Extracts all valid property paths from a document type.

## Type Parameters

### T

`T`

The document type

## Remarks

Generates a union type of all possible paths through the document structure,
including nested properties. Uses type-fest's `Paths` utility internally.

## Example

```typescript
interface User extends Document {
  name: string;
  profile: {
    bio: string;
    settings: {
      theme: 'light' | 'dark';
    };
  };
}

// DocumentPath<User> produces:
// 'name' | 'profile' | 'profile.bio' | 'profile.settings' | 'profile.settings.theme'
```
