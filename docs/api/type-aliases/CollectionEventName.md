[stratadb](../index.md) / CollectionEventName

# Type Alias: CollectionEventName

```ts
type CollectionEventName = keyof CollectionEventMap<Document>;
```

Defined in: [src/collection-events.ts:402](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L402)

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
