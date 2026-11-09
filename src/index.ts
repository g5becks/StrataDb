/**
 * StrataDB - A type-safe document database built on SQLite
 *
 * @packageDocumentation
 *
 * @remarks
 * StrataDB provides a MongoDB-like API with full TypeScript type safety,
 * backed by SQLite for reliability and performance. It uses JSONB storage
 * with generated columns for indexed fields.
 *
 * @example
 * ```typescript
 * import { Strata, createSchema, type Document } from 'stratadb';
 *
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   age: number;
 * }>;
 *
 * const userSchema = createSchema<User>()
 *   .field('name', { type: 'TEXT', indexed: true })
 *   .field('email', { type: 'TEXT', indexed: true, unique: true })
 *   .field('age', { type: 'INTEGER', indexed: true })
 *   .build();
 *
 * const db = new Strata({ database: 'app.db' });
 * const users = db.collection('users', userSchema);
 *
 * await users.insertOne({ name: 'Alice', email: 'alice@example.com', age: 30 });
 * const adults = await users.find({ age: { $gte: 18 } });
 * ```
 */

// Abort utilities
// biome-ignore lint/performance/noBarrelFile: library entry point requires re-exports
export { createAbortPromise, throwIfAborted } from "./abort-utils.js"
export type { CollectionBuilder } from "./collection-builder.js"
// Collection event types
export {
  CollectionEventEmitter,
  type CollectionEventMap,
  type CollectionEventName,
  type DeleteEvent,
  type DeleteManyEvent,
  type DropEvent,
  type ErrorEvent,
  type FindOneAndDeleteEvent,
  type FindOneAndReplaceEvent,
  type FindOneAndUpdateEvent,
  type InsertEvent,
  type InsertManyEvent,
  type ReplaceEvent,
  type UpdateEvent,
  type UpdateManyEvent,
} from "./collection-events.js"
// Collection types
export type {
  Collection,
  DeleteResult,
  InsertManyResult,
  InsertOneResult,
  UpdateResult,
} from "./collection-types.js"
// Core document types
export type {
  BulkWriteResult,
  Document,
  DocumentInput,
  DocumentUpdate,
} from "./core-types.js"
// Database types
export type {
  DatabaseOptions,
  StrataDB,
  Transaction,
} from "./database-types.js"
// Error types
export {
  AbortedError,
  ConnectionError,
  ConstraintError,
  DatabaseError,
  InvalidQueryOperatorError,
  QueryError,
  SchemaValidationError,
  StrataDBError,
  TransactionAbortedError,
  TransactionError,
  TypeMismatchError,
  UniqueConstraintError,
  ValidationError,
} from "./errors.js"
// ID generation
export { generateId, type IdGenerator } from "./id-generator.js"
// Path types for advanced schema definitions
export type { DocumentPath, JsonPath, PathValue } from "./path-types.js"
export type {
  CursorSpec,
  OmitSpec,
  ProjectedDocument,
  ProjectionSpec,
  QueryOptions,
  QueryOptionsBase,
  QueryOptionsWithOmit,
  QueryOptionsWithoutProjection,
  QueryOptionsWithSelect,
  SelectSpec,
  SortSpec,
  TextSearchSpec,
} from "./query-options-types.js"
// Query types
export type {
  ArrayOperator,
  ComparisonOperator,
  EqualityOperators,
  ExistenceOperator,
  FieldOperator,
  LogicalOperator,
  MembershipOperators,
  OrderingOperators,
  QueryFilter,
  StringOperator,
} from "./query-types.js"
// Retry types and utilities
export type { RetryContext, RetryOptions } from "./retry-types.js"
export {
  defaultShouldRetry,
  mergeRetryOptions,
  withRetry,
} from "./retry-utils.js"
export { createSchema } from "./schema-builder.js"
export type { SchemaBuilder } from "./schema-builder-types.js"
// Schema types and builder
export type {
  CompoundIndex,
  SchemaDefinition,
  SchemaField,
  SQLiteType,
  TimestampConfig,
  TypeScriptToSQLite,
} from "./schema-types.js"
// Main database class
export { Strata } from "./stratadb.js"
// Timestamp utilities
export {
  dateToTimestamp,
  isTimestampInRange,
  isValidTimestamp,
  nowTimestamp,
  timestampDiff,
  timestampToDate,
} from "./timestamps.js"
