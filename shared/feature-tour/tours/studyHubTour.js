export const DASHBOARD_TOUR_ID = 'study-hub-with-sidebar';

export function adaptDashboardTourSteps(steps, { isPhone = false } = {}) {
  if (!isPhone) return steps;
  return steps
    .filter((step) => step.id !== 'sidebar-nav' && step.id !== 'sidebar-account')
    .map((step) => {
      if (step.id === 'create') return { ...step, placement: 'top' };
      if (step.id === 'my-notes' || step.id === 'search-filter' || step.id === 'organize') {
        return { ...step, placement: 'bottom' };
      }
      return step;
    });
}

export const DASHBOARD_TOUR_STEPS = [
  {
    id: 'sidebar-nav',
    title: 'Navigate your workspace',
    body: 'Home, Podcasts, Exam prep, and Study stats live in the sidebar. Jump between them anytime.',
    placement: 'right',
  },
  {
    id: 'sidebar-account',
    title: 'Account and progress',
    body: 'Manage subscription & rewards, and open your profile from here.',
    placement: 'right',
  },
  {
    id: 'create',
    title: 'Create notes your way',
    body: 'Upload a file, paste a link, or record audio. Then get notes, flashcards, and quizzes.',
    placement: 'bottom',
  },
  {
    id: 'my-notes',
    title: 'Your notes library',
    body: 'My Notes keeps everything you create in one place. Switch between list and grid, including folders.',
    placement: 'top',
  },
  {
    id: 'search-filter',
    title: 'Find what you need',
    body: 'Search across notes and folders, then filter the list when you only want one type.',
    placement: 'bottom',
  },
  {
    id: 'organize',
    title: 'Organize and manage',
    body: 'Create folders, export PDFs, rename items, or delete anything you no longer need.',
    placement: 'left',
  },
];
