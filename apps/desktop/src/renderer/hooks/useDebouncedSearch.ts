import { useState, useCallback, useRef, useEffect } from 'react';

interface UseDebouncedSearchResult {
  /** Current search query (immediate) */
  searchQuery: string;
  /** Debounced search query (after delay) */
  debouncedSearch: string;
  /** Update search query with debounce */
  handleSearch: (query: string) => void;
  /** Clear both immediate and debounced search */
  clearSearch: () => void;
}

/**
 * Hook for managing debounced search state.
 *
 * Provides both immediate query (for input display) and
 * debounced query (for API calls).
 *
 * @param delay - Debounce delay in milliseconds (default: 300)
 */
export function useDebouncedSearch(delay = 300): UseDebouncedSearchResult {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Handle search with debounce
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        setDebouncedSearch(query);
      }, delay);
    },
    [delay]
  );

  // Clear both immediate and debounced search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearch('');
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    searchQuery,
    debouncedSearch,
    handleSearch,
    clearSearch,
  };
}
