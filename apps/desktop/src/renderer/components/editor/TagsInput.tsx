import { memo } from 'react';
import { Tag } from 'lucide-react';

interface TagsInputProps {
  /** Tags to display (read-only in Phase 1) */
  readonly tags: readonly string[];
}

/**
 * TagsInput - Read-only display of note tags
 *
 * Phase 1: Display only (no editing)
 * Future: Add input field for adding/removing tags
 */
export const TagsInput = memo(function TagsInput({ tags }: TagsInputProps) {
  if (tags.length === 0) {
    return (
      <div className="tags-display">
        <Tag size={14} className="dropdown-icon" style={{ color: 'var(--text-faint)' }} />
        <span className="tags-display-empty">Add Tags</span>
      </div>
    );
  }

  return (
    <div className="tags-display">
      <Tag size={14} className="dropdown-icon" style={{ color: 'var(--text-muted)' }} />
      <div className="tags-display-chips">
        {tags.slice(0, 3).map(tag => (
          <span key={tag} className="tag-chip">
            <span className="tag-hash">#</span>
            {tag}
          </span>
        ))}
        {tags.length > 3 && (
          <span className="tag-chip">+{tags.length - 3}</span>
        )}
      </div>
    </div>
  );
});
