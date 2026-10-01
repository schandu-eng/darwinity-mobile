export const CARD_DECK_EDIT_TOUR_ID = 'card-deck-edit-fields';

export const CARD_DECK_EDIT_TOUR_STEPS = [
  {
    id: 'edit-front',
    title: 'Write the front',
    body: 'This is the question or prompt you see first while studying.',
    placement: 'bottom',
  },
  {
    id: 'edit-back',
    title: 'Write the back',
    body: 'Put the answer here. Flip the card in study mode to reveal it.',
    placement: 'top',
  },
  {
    id: 'edit-hint',
    title: 'Optional hint',
    body: 'Add a short hint if you want a nudge before flipping. Skip it if you do not need one.',
    placement: 'top',
  },
];
