/**
 * CoreResult - Result type for core operations
 *
 * All core operations return a Result type for explicit error handling
 */

import type { ValidationError } from '../domain/invariants.js';

/** Error types that can occur in core operations */
export type CoreError =
  | { type: 'VALIDATION_ERROR'; error: ValidationError }
  | { type: 'NOT_FOUND'; id: string }
  | { type: 'ALREADY_EXISTS'; id: string }
  | { type: 'STORAGE_ERROR'; message: string };

/** A successful result containing data */
export interface Success<T> {
  readonly ok: true;
  readonly data: T;
}

/** A failed result containing an error */
export interface Failure {
  readonly ok: false;
  readonly error: CoreError;
}

/** Result type for operations that can fail */
export type Result<T> = Success<T> | Failure;

/** Creates a success result */
export function success<T>(data: T): Success<T> {
  return { ok: true, data };
}

/** Creates a failure result */
export function failure(error: CoreError): Failure {
  return { ok: false, error };
}

/** Creates a validation error failure */
export function validationError(error: ValidationError): Failure {
  return failure({ type: 'VALIDATION_ERROR', error });
}

/** Creates a not found failure */
export function notFound(id: string): Failure {
  return failure({ type: 'NOT_FOUND', id });
}

/** Creates an already exists failure */
export function alreadyExists(id: string): Failure {
  return failure({ type: 'ALREADY_EXISTS', id });
}

/** Creates a storage error failure */
export function storageError(message: string): Failure {
  return failure({ type: 'STORAGE_ERROR', message });
}

/** Type guard to check if result is success */
export function isSuccess<T>(result: Result<T>): result is Success<T> {
  return result.ok === true;
}

/** Type guard to check if result is failure */
export function isFailure<T>(result: Result<T>): result is Failure {
  return result.ok === false;
}

/** Unwraps a result, throwing if it's a failure */
export function unwrap<T>(result: Result<T>): T {
  if (isSuccess(result)) {
    return result.data;
  }
  throw new Error(`Unwrap failed: ${JSON.stringify(result.error)}`);
}
