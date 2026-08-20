/**
 * Link Anchors Migration
 *
 * Adds support for heading anchors in wikilinks: [[Note#Heading]]
 *
 * Design decisions:
 * - target_anchor stores the heading text (e.g., "Section One" from [[Note#Section One]])
 * - Unique constraint includes anchor to allow same target with different anchors
 */

import type { Migration } from '@dripnex/storage-core';

export const addLinkAnchors: Migration = {
  version: 20260107000001,
  name: 'link_anchors',
  up: `
    -- Add anchor column to links table
    ALTER TABLE links ADD COLUMN target_anchor TEXT;

    -- Drop old unique constraint and create new one including anchor
    DROP INDEX IF EXISTS idx_links_source_target;

    -- Recreate unique index to include anchor (COALESCE handles NULL)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_links_source_target_anchor
    ON links(source_note_id, target_ref, COALESCE(target_anchor, ''));
  `,
};
