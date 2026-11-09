[stratadb](../index.md) / CollectionEventName

# Type Alias: CollectionEventName

```ts
type CollectionEventName = keyof CollectionEventMap<Document>;
```

Defined in: [src/collection-events.ts:393](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/collection-events.ts#L393)

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
