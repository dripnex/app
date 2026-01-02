/**
 * Domain Invariants - Business rules that must always hold
 *
 * These are the non-negotiable rules of the Readied domain
 */

import type { Note } from './note.js';
import type { NoteId } from './types.js';

/** Maximum content size (10MB) */
export const MAX_CONTENT_SIZE = 10 * 1024 * 1024;

/** Minimum content length (can be empty, but not null/undefined) */
export const MIN_CONTENT_LENGTH = 0;

/** Validation error types */
export type ValidationError =
  | { type: 'CONTENT_TOO_LARGE'; maxSize: number; actualSize: number }
  | { type: 'INVALID_ID'; reason: string }
  | { type: 'INVALID_CONTENT'; reason: string }
  | { type: 'INVALID_TITLE'; reason: string };

/** Result of validating a note */
export type ValidationResult = { valid: true } | { valid: false; error: ValidationError };

/** Validates that content size is within limits */
export function validateContentSize(content: string): ValidationResult {
  const size = new TextEncoder().encode(content).length;

  if (size > MAX_CONTENT_SIZE) {
    return {
      valid: false,
      error: {
        type: 'CONTENT_TOO_LARGE',
        maxSize: MAX_CONTENT_SIZE,
        actualSize: size,
      },
    };
  }

  return { valid: true };
}

/** Validates a NoteId */
export function validateNoteId(id: NoteId): ValidationResult {
  if (!id || typeof id !== 'string') {
    return {
      valid: false,
      error: { type: 'INVALID_ID', reason: 'ID must be a non-empty string' },
    };
  }

  if (id.length > 255) {
    return {
      valid: false,
      error: { type: 'INVALID_ID', reason: 'ID must be 255 characters or less' },
    };
  }

  return { valid: true };
}

/** Validates content is a valid string */
export function validateContent(content: string): ValidationResult {
  if (content === null || content === undefined) {
    return {
      valid: false,
      error: { type: 'INVALID_CONTENT', reason: 'Content cannot be null or undefined' },
    };
  }

  if (typeof content !== 'string') {
    return {
      valid: false,
      error: { type: 'INVALID_CONTENT', reason: 'Content must be a string' },
    };
  }

  return validateContentSize(content);
}

/** Maximum title length */
export const MAX_TITLE_LENGTH = 255;

/** Validates a title */
export function validateTitle(title: string): ValidationResult {
  const trimmed = title.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      error: { type: 'INVALID_TITLE', reason: 'Title cannot be empty' },
    };
  }

  if (trimmed.length > MAX_TITLE_LENGTH) {
    return {
      valid: false,
      error: { type: 'INVALID_TITLE', reason: `Title cannot exceed ${MAX_TITLE_LENGTH} characters` },
    };
  }

  return { valid: true };
}

/** Validates an entire note */
export function validateNote(note: Note): ValidationResult {
  const idResult = validateNoteId(note.id);
  if (!idResult.valid) return idResult;

  const contentResult = validateContent(note.content);
  if (!contentResult.valid) return contentResult;

  return { valid: true };
}
