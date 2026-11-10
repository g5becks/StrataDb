import type {
  CollectionEventEmitter,
  CollectionEventMap,
  CollectionEventName,
} from "./collection-events.js"
import type { Document } from "./core-types.js"

/** Typed facade over Node's conditional built-in/generic listener overloads. */
export function registerCollectionListener<
  T extends Document,
  E extends CollectionEventName,
>(
  emitter: CollectionEventEmitter<T>,
  operation: "on" | "once" | "off",
  event: E,
  listener: (...args: CollectionEventMap<T>[E]) => void
): void {
  Reflect.apply(emitter[operation], emitter, [event, listener])
}
