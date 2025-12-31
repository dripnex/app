/**
 * Zod Validation Schemas
 *
 * These schemas validate external input before it enters the core
 */

import { z } from 'zod';
import { MAX_CONTENT_SIZE } from '../domain/invariants.js';

/** Schema for note content */
export const contentSchema = z
  .string()
  .min(0, 'Content cannot be null')
  .max(MAX_CONTENT_SIZE, `Content exceeds maximum size of ${MAX_CONTENT_SIZE} bytes`);

/** Schema for note ID */
export const noteIdSchema = z
  .string()
  .min(1, 'ID cannot be empty')
  .max(255, 'ID must be 255 characters or less');

/** Schema for creating a note */
export const createNoteInputSchema = z.object({
  content: contentSchema,
  id: noteIdSchema.optional(),
});

/** Schema for updating a note */
export const updateNoteInputSchema = z.object({
  id: noteIdSchema,
  content: contentSchema,
});

/** Schema for deleting a note */
export const deleteNoteInputSchema = z.object({
  id: noteIdSchema,
});

/** Schema for getting a note */
export const getNoteInputSchema = z.object({
  id: noteIdSchema,
});

/** Schema for listing notes */
export const listNotesInputSchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().min(0).default(0),
  tag: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/** Schema for searching notes */
export const searchNotesInputSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().positive().max(100).default(20),
});

/** Inferred types from schemas */
export type CreateNoteInputSchema = z.infer<typeof createNoteInputSchema>;
export type UpdateNoteInputSchema = z.infer<typeof updateNoteInputSchema>;
export type DeleteNoteInputSchema = z.infer<typeof deleteNoteInputSchema>;
export type GetNoteInputSchema = z.infer<typeof getNoteInputSchema>;
export type ListNotesInputSchema = z.infer<typeof listNotesInputSchema>;
export type SearchNotesInputSchema = z.infer<typeof searchNotesInputSchema>;
