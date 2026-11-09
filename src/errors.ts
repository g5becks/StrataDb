export type SQLiteErrorContext = {
  readonly sql?: string
  readonly collection?: string
  readonly operation?: string
}

/**
 * Abstract base class for all StrataDB errors.
 *
 * @remarks
 * All StrataDB-specific errors extend this class, providing a consistent interface
 * for error handling throughout the library. Each error has a unique code and category
 * for programmatic error handling and response.
 *
 * @example
 * ```typescript
 * try {
 *   await users.insertOne(invalidUser);
 * } catch (error) {
 *   if (error instanceof StrataDBError) {
 *     console.log(`Error: ${error.code} in category: ${error.category}`);
 *
 *     switch (error.category) {
 *       case 'validation':
 *         // Handle validation errors
 *         break;
 *       case 'database':
 *         // Handle database errors
 *         break;
 *       case 'query':
 *         // Handle query errors
 *         break;
 *       case 'transaction':
 *         // Handle transaction errors
 *         break;
 *     }
 *   }
 * }
 * ```
 */
export abstract class StrataDBError extends Error {
  readonly errno?: number | undefined
  readonly sqliteCodeName?: string | undefined
  readonly context?: SQLiteErrorContext | undefined
  override readonly cause?: unknown
  /** Unique error code for programmatic identification */
  abstract readonly code: string

  /** Error category for grouping related error types */
  abstract readonly category:
    | "validation"
    | "query"
    | "database"
    | "transaction"

  constructor(message: string) {
    super(message)
    this.name = this.constructor.name

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

/**
 * Base class for validation-related errors.
 *
 * @remarks
 * Thrown when data fails validation against schema or type constraints.
 * Provides detailed context about what failed validation.
 *
 * @example
 * ```typescript
 * try {
 *   users.insertOne({ name: 123 }); // name should be string
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.log(`Field '${error.field}' failed validation: ${error.message}`);
 *     console.log(`Invalid value:`, error.value);
 *   }
 * }
 * ```
 */
export class ValidationError extends StrataDBError {
  readonly category = "validation" as const
  readonly code = "VALIDATION_ERROR"

  /** Optional field name that failed validation */
  readonly field?: string | undefined

  /** The value that failed validation */
  readonly value?: unknown

  constructor(message: string, field?: string, value?: unknown) {
    super(message)
    this.field = field
    this.value = value
  }
}

/**
 * Error thrown when document fails schema validation.
 *
 * @remarks
 * Specific to schema-based validation failures using Standard Schema validators.
 * Extends ValidationError with schema-specific context.
 *
 * @example
 * ```typescript
 * try {
 *   users.insertOne({ email: 'invalid-email' });
 * } catch (error) {
 *   if (error instanceof SchemaValidationError) {
 *     console.log('Schema validation failed:', error.message);
 *     // The field and value properties provide additional context
 *   }
 * }
 * ```
 */
export class SchemaValidationError extends StrataDBError {
  readonly category = "validation" as const
  readonly code = "SCHEMA_VALIDATION_ERROR"

  /** Optional field name that failed validation */
  readonly field?: string | undefined

  /** The value that failed validation */
  readonly value?: unknown

  constructor(message: string, field?: string, value?: unknown) {
    super(message)
    this.field = field
    this.value = value
  }
}

/**
 * Base class for query-related errors.
 *
 * @remarks
 * Thrown when there are issues with query syntax, operators, or execution.
 * Provides context about the query that caused the error.
 *
 * @example
 * ```typescript
 * try {
 *   await users.find({ $invalidOperator: 'value' });
 * } catch (error) {
 *   if (error instanceof QueryError) {
 *     console.log('Query error:', error.message);
 *     console.log('Problematic query:', error.query);
 *   }
 * }
 * ```
 */
export class QueryError extends StrataDBError {
  readonly category = "query" as const
  readonly code = "QUERY_ERROR"

  /** The query that caused the error (if available) */
  readonly query?: string | undefined

  constructor(message: string, query?: string) {
    super(message)
    this.query = query
  }
}

/**
 * Error thrown when an invalid query operator is used.
 *
 * @remarks
 * Thrown when query operators don't match the field type or don't exist.
 * Provides specific guidance about valid operators for the context.
 *
 * @example
 * ```typescript
 * try {
 *   await users.find({ name: { $gt: 'John' } }); // $gt doesn't work on strings
 * } catch (error) {
 *   if (error instanceof InvalidQueryOperatorError) {
 *     console.log('Invalid operator:', error.message);
 *   }
 * }
 * ```
 */
export class InvalidQueryOperatorError extends StrataDBError {
  readonly category = "query" as const
  readonly code = "INVALID_QUERY_OPERATOR"

  /** The query that caused the error (if available) */
  readonly query?: string | undefined

  constructor(message: string, query?: string) {
    super(message)
    this.query = query
  }
}

/**
 * Error thrown when there's a type mismatch in queries.
 *
 * @remarks
 * Provides detailed context about the expected vs actual types,
 * helping developers fix query type issues.
 *
 * @example
 * ```typescript
 * try {
 *   await users.find({ age: 'thirty' }); // age field expects number
 * } catch (error) {
 *   if (error instanceof TypeMismatchError) {
 *     console.log(`Field '${error.field}' expects ${error.expectedType}, got ${error.actualType}`);
 *     console.log('Invalid value:', error.value);
 *   }
 * }
 * ```
 */
/** @deprecated Reserved for compatibility; validation uses ValidationError or QueryError. */
export class TypeMismatchError extends StrataDBError {
  readonly category = "query" as const
  readonly code = "TYPE_MISMATCH"

  /** The query that caused the error (if available) */
  readonly query?: string | undefined

  /** The field with type mismatch */
  readonly field?: string | undefined

  /** The expected type for the field */
  readonly expectedType?: string | undefined

  /** The actual type provided */
  readonly actualType?: string | undefined

  constructor(
    message: string,
    options?: {
      field?: string
      expectedType?: string
      actualType?: string
      query?: string
    }
  ) {
    super(message)
    this.field = options?.field
    this.expectedType = options?.expectedType
    this.actualType = options?.actualType
    this.query = options?.query
  }
}

/**
 * Base class for database-related errors.
 *
 * @remarks
 * Thrown when there are issues with database operations, connections, or constraints.
 * Includes SQLite error codes when available.
 *
 * @example
 * ```typescript
 * try {
 *   await db.collection('users').insertOne(data);
 * } catch (error) {
 *   if (error instanceof DatabaseError) {
 *     console.log('Database error:', error.message);
 *     if (error.sqliteCode) {
 *       console.log('SQLite code:', error.sqliteCode);
 *     }
 *   }
 * }
 * ```
 */
export class DatabaseError extends StrataDBError {
  readonly category = "database" as const
  readonly code = "DATABASE_ERROR"

  /** SQLite error code (if available) */
  readonly sqliteCode?: number | undefined

  constructor(message: string, sqliteCode?: number) {
    super(message)
    this.sqliteCode = sqliteCode
  }
}

/**
 * Error thrown when database connection fails.
 *
 * @remarks
 * Typically thrown during database initialization or when connection is lost.
 *
 * @example
 * ```typescript
 * try {
 *   const db = new StrataDB({ database: '/invalid/path/db.sqlite' });
 * } catch (error) {
 *   if (error instanceof ConnectionError) {
 *     console.log('Failed to connect to database:', error.message);
 *   }
 * }
 * ```
 */
export class ConnectionError extends StrataDBError {
  readonly category = "database" as const
  readonly code = "CONNECTION_ERROR"

  /** SQLite error code (if available) */
  readonly sqliteCode?: number | undefined

  constructor(message: string, sqliteCode?: number) {
    super(message)
    this.sqliteCode = sqliteCode
  }
}

/**
 * Error thrown when database constraints are violated.
 *
 * @remarks
 * Includes constraint type and context when available.
 *
 * @example
 * ```typescript
 * try {
 *   await users.insertOne({ email: existingEmail }); // Violates unique constraint
 * } catch (error) {
 *   if (error instanceof ConstraintError) {
 *     console.log(`Constraint '${error.constraint}' violated:`, error.message);
 *   }
 * }
 * ```
 */
export class ConstraintError extends StrataDBError {
  readonly category = "database" as const
  readonly code = "CONSTRAINT_ERROR"

  /** SQLite error code (if available) */
  readonly sqliteCode?: number | undefined

  /** The constraint that was violated */
  readonly constraint?: string | undefined

  constructor(message: string, constraint?: string, sqliteCode?: number) {
    super(message)
    this.constraint = constraint
    this.sqliteCode = sqliteCode
  }
}

/**
 * Error thrown when unique constraint is violated.
 *
 * @remarks
 * Provides specific context about the field and value that violated uniqueness.
 *
 * @example
 * ```typescript
 * try {
 *   await users.insertOne({ email: 'duplicate@example.com' });
 * } catch (error) {
 *   if (error instanceof UniqueConstraintError) {
 *     console.log(`Duplicate value for field '${error.field}': ${error.value}`);
 *     // Suggest using upsert instead
 *   }
 * }
 * ```
 */
export class UniqueConstraintError extends StrataDBError {
  readonly category = "database" as const
  readonly code = "UNIQUE_CONSTRAINT_ERROR"

  /** SQLite error code (if available) */
  readonly sqliteCode?: number | undefined

  /** The field with unique constraint violation */
  readonly field?: string | undefined

  /** The value that violated the unique constraint */
  readonly value?: unknown

  constructor(
    message: string,
    field?: string,
    value?: unknown,
    sqliteCode?: number
  ) {
    super(message)
    this.field = field
    this.value = value
    this.sqliteCode = sqliteCode
  }
}

/**
 * Base class for transaction-related errors.
 *
 * @remarks
 * Thrown when there are issues with transaction management, execution, or state.
 *
 * @example
 * ```typescript
 * try {
 *   await db.transaction(async (tx) => {
 *     // Transaction operations
 *   });
 * } catch (error) {
 *   if (error instanceof TransactionError) {
 *     console.log('Transaction error:', error.message);
 *   }
 * }
 * ```
 */
export class TransactionError extends StrataDBError {
  readonly category = "transaction" as const
  readonly code = "TRANSACTION_ERROR"
}

/**
 * Error thrown when a transaction is aborted.
 *
 * @remarks
 * Typically thrown when an error occurs within a transaction
 * and automatic rollback is performed.
 *
 * @example
 * ```typescript
 * try {
 *   await db.transaction(async (tx) => {
 *     await tx.collection('users').insertOne(user1);
 *     throw new Error('Something went wrong'); // Triggers rollback
 *     await tx.collection('users').insertOne(user2); // Never reached
 *   });
 * } catch (error) {
 *   if (error instanceof TransactionAbortedError) {
 *     console.log('Transaction was rolled back:', error.message);
 *   }
 * }
 * ```
 */
/** @deprecated Use AbortedError for cancellation; retained for compatibility. */
export class TransactionAbortedError extends StrataDBError {
  readonly category = "transaction" as const
  readonly code = "TRANSACTION_ABORTED"
}

/**
 * Error thrown when an operation is aborted via AbortSignal.
 *
 * @remarks
 * This error is thrown when an AbortSignal is triggered during an operation.
 * The original abort reason is preserved in the `reason` property.
 *
 * When used with retry, p-retry will automatically stop retrying when this error is thrown.
 *
 * @example
 * ```typescript
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 100);
 *
 * try {
 *   await users.find({}, { signal: controller.signal });
 * } catch (error) {
 *   if (error instanceof AbortedError) {
 *     console.log('Operation aborted:', error.reason);
 *   }
 * }
 * ```
 */
export class AbortedError extends StrataDBError {
  readonly category = "database" as const
  readonly code = "OPERATION_ABORTED"

  /** The abort reason from the AbortSignal */
  readonly reason?: unknown

  constructor(message: string, reason?: unknown) {
    super(message)
    this.reason = reason
  }
}
