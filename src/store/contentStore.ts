import { create } from 'zustand';
import type { ContentType } from '@/api/schemas/content';

interface ContentState {
  searchQuery: string;
  contentTypeFilter: ContentType | 'all';
  selectedContentId: number | null;
  setSearchQuery: (query: string) => void;
  setContentTypeFilter: (filter: ContentType | 'all') => void;
  setSelectedContentId: (id: number | null) => void;
  resetFilters: () => void;
}

export const useContentStore = create<ContentState>((set) => ({
  searchQuery: '',
  contentTypeFilter: 'all',
  selectedContentId: null,
  setSearchQuery: (query) => set({ searchQuery: query }),
  setContentTypeFilter: (filter) => set({ contentTypeFilter: filter }),
  setSelectedContentId: (id) => set({ selectedContentId: id }),
  resetFilters: () =>
    set({
      searchQuery: '',
      contentTypeFilter: 'all',
      selectedContentId: null,
    }),
}));

