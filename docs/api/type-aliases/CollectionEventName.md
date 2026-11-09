[stratadb](../index.md) / CollectionEventName

# Type Alias: CollectionEventName

```ts
type CollectionEventName = keyof CollectionEventMap<Document>;
```

Defined in: [src/collection-events.ts:393](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L393)

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
