/**
 * Wikilink Types
 *
 * Core types for the wikilinks system.
 */

/** Represents a parsed wikilink from content */
export interface WikilinkRef {
  /** The target reference (note title, what's before # or |) */
  target: string;
  /** Optional heading anchor (after # in [[target#heading]]) */
  anchor?: string;
  /** Optional display text (after | in [[target|display]]) */
  display?: string;
}
