[stratadb](../index.md) / CollectionEventName

# Type Alias: CollectionEventName

```ts
type CollectionEventName = keyof CollectionEventMap<Document>;
```

Defined in: [src/collection-events.ts:393](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-events.ts#L393)

Type-safe event names for collections.

## Remarks

Union type of all valid event names that can be used with collection
event listeners. This ensures that only valid event names can be passed
to methods like `on()`, `once()`, `off()`, etc.

## Example

```typescript
const eventName: CollectionEventName = 'insert' // Valid
const invalid: CollectionEventName = 'invalid' // Type error
```
