import { useState, useCallback, useEffect, useRef } from 'react';

interface NotebookCreateFormProps {
  readonly parentId?: string | null;
  readonly onSubmit: (name: string, parentId: string | null) => void;
  readonly onCancel: () => void;
}

export function NotebookCreateForm({ parentId, onSubmit, onCancel }: NotebookCreateFormProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = name.trim();
      if (trimmedName) {
        onSubmit(trimmedName, parentId ?? null);
      }
    },
    [name, parentId, onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel]
  );

  return (
    <form onSubmit={handleSubmit} className="notebook-create-form">
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Notebook name"
        className="notebook-create-input"
        aria-label="New notebook name"
      />
      <div className="notebook-create-actions">
        <button
          type="submit"
          className="notebook-create-btn notebook-create-btn--primary"
          disabled={!name.trim()}
        >
          Create
        </button>
        <button
          type="button"
          className="notebook-create-btn notebook-create-btn--secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
