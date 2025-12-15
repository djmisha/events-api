/**
 * Error Handling Utilities
 *
 * Provides utilities for safe error serialization and handling in logging contexts.
 * Designed to work with Pino structured logging and avoid circular reference issues.
 */

/**
 * Serializable error object structure for structured logging
 * Includes standard Error properties plus database-specific fields
 */
export type SerializableError = {
  /** Error class name (e.g., "Error", "TypeError") */
  name?: string;
  /** Human-readable error message */
  message?: string;
  /** Stack trace (useful in development, omitted in production logs) */
  stack?: string;
  /** Database error code (e.g., "23505" for unique violation) */
  code?: unknown;
  /** Additional error details from Supabase/Postgres */
  details?: unknown;
  /** Database hint for resolving the error */
  hint?: unknown;
  /** HTTP status code if applicable */
  status?: unknown;
};

/**
 * Safely serialize an error object for logging
 * Extracts key properties from Error instances and error-like objects
 *
 * Handles three cases:
 * 1. Error instances - extracts name, message, stack, and extended properties
 * 2. Error-like objects - safely extracts known properties with type guards
 * 3. Primitives - converts to string message
 *
 * This prevents circular reference errors in JSON serialization and
 * ensures Supabase/Postgres error details are preserved for debugging.
 *
 * @param error - The error to serialize (Error, object, or primitive)
 * @returns A plain object with error properties safe for JSON serialization
 *
 * @example
 * try {
 *   await supabase.from('artists').insert(duplicate);
 * } catch (error) {
 *   logger.error({ error: serializeError(error) }, 'Insert failed');
 *   // Output: { code: "23505", message: "duplicate key value", hint: "..." }
 * }
 */
export function serializeError(error: unknown): SerializableError {
  if (error instanceof Error) {
    const extended = error as Error & Record<string, unknown>;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: extended.code,
      details: extended.details,
      hint: extended.hint,
      status: extended.status,
    };
  }

  if (typeof error === "object" && error !== null) {
    const extended = error as Record<string, unknown>;
    return {
      name: typeof extended.name === "string" ? extended.name : undefined,
      message:
        typeof extended.message === "string" ? extended.message : undefined,
      stack: typeof extended.stack === "string" ? extended.stack : undefined,
      code: extended.code,
      details: extended.details,
      hint: extended.hint,
      status: extended.status,
    };
  }

  return { message: String(error) };
}

export default {
  serializeError,
};
