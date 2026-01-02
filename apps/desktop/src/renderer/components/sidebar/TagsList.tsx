import { Hash } from 'lucide-react';
import { useTags } from '../../hooks/useNotes';
import { useNavigation, useNavigationActions } from '../../hooks/useNavigation';

interface TagsListProps {
  readonly onSelectTag: (tag: string) => void;
}

export function TagsList({ onSelectTag }: TagsListProps) {
  const { data: tags = [], isLoading } = useTags();
  const navigation = useNavigation();
  const { goToTag } = useNavigationActions();

  // Get currently selected tag (if any)
  const selectedTag = navigation.kind === 'tag' ? navigation.name : null;

  const handleTagClick = (tag: string) => {
    goToTag(tag);
    onSelectTag(tag);
  };

  if (isLoading) {
    return (
      <div className="tags-list-loading" aria-busy="true">
        <span className="tags-list-loading-text">Loading tags...</span>
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="tags-list-empty">
        <span className="tags-list-empty-text">No tags yet</span>
        <span className="tags-list-empty-hint">Add #tags in your notes</span>
      </div>
    );
  }

  return (
    <ul className="tags-list" role="listbox" aria-label="Tags">
      {tags.map(tag => (
        <li key={tag} role="option" aria-selected={tag === selectedTag}>
          <button
            type="button"
            className={`tags-list-item ${tag === selectedTag ? 'selected' : ''}`}
            onClick={() => handleTagClick(tag)}
          >
            <Hash size={14} className="tags-list-item-icon" aria-hidden="true" />
            <span className="tags-list-item-name">{tag}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
