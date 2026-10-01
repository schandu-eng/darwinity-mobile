import React, { createContext, useContext } from 'react';

export type CreateNoteIntent = 'note' | 'podcast';
export type CreateNoteOption = 'upload' | 'paste' | 'record';

type CreateNoteContextValue = {
  openCreateNote: (intent?: CreateNoteIntent) => void;
  openCreateOption: (option: CreateNoteOption) => void;
};

const CreateNoteContext = createContext<CreateNoteContextValue>({
  openCreateNote: () => {},
  openCreateOption: () => {},
});

export const CreateNoteProvider = CreateNoteContext.Provider;

export function useCreateNote(): CreateNoteContextValue {
  return useContext(CreateNoteContext);
}
