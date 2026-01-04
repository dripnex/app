/**
 * Wikilink Types
 *
 * Core types for the wikilinks system.
 */

/** Represents a parsed wikilink from content */
export interface WikilinkRef {
  /** The target reference (what's inside [[...]]) */
  target: string;
  /** Optional display text (after | in [[target|display]]) */
  display?: string;
}
