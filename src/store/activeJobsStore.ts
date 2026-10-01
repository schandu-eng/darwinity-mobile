import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const ACTIVE_JOBS_STORAGE_KEY = '@darwinity_active_jobs';

export interface ActiveJob {
  jobId: string;
  contentTitle: string;
  timestamp: number;
  sourceScreen?: string;
}

interface ActiveJobsState {
  activeJobs: ActiveJob[];
  addJob: (job: ActiveJob) => Promise<void>;
  removeJob: (jobId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  initialize: () => Promise<void>;
}

const loadActiveJobs = async (): Promise<ActiveJob[]> => {
  try {
    const data = await AsyncStorage.getItem(ACTIVE_JOBS_STORAGE_KEY);
    if (!data) return [];
    const jobs = JSON.parse(data) as ActiveJob[];
    return jobs.filter((job) => Date.now() - job.timestamp < 24 * 60 * 60 * 1000);
  } catch (error) {
    console.error('Failed to load active jobs:', error);
    return [];
  }
};

const saveActiveJobs = async (jobs: ActiveJob[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(ACTIVE_JOBS_STORAGE_KEY, JSON.stringify(jobs));
  } catch (error) {
    console.error('Failed to save active jobs:', error);
  }
};

let persistTimer: ReturnType<typeof setTimeout> | null = null;
type GlobalWithActiveJobsListener = typeof globalThis & {
  __darwinityActiveJobsListenerRegistered__?: boolean;
};
const globalWithListener = globalThis as GlobalWithActiveJobsListener;

const schedulePersist = (jobs: ActiveJob[]) => {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    void saveActiveJobs(jobs);
    persistTimer = null;
  }, 1000);
};

const flushPersist = () => {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  void saveActiveJobs(useActiveJobsStore.getState().activeJobs);
};

export const useActiveJobsStore = create<ActiveJobsState>((set, get) => ({
  activeJobs: [],
  addJob: async (job: ActiveJob) => {
    const currentJobs = get().activeJobs;
    const exists = currentJobs.some((j) => j.jobId === job.jobId);
    if (exists) return;

    const updatedJobs = [...currentJobs, job];
    set({ activeJobs: updatedJobs });
    schedulePersist(updatedJobs);
  },
  removeJob: async (jobId: string) => {
    const currentJobs = get().activeJobs;
    const updatedJobs = currentJobs.filter((j) => j.jobId !== jobId);
    set({ activeJobs: updatedJobs });
    schedulePersist(updatedJobs);
  },
  clearAll: async () => {
    set({ activeJobs: [] });
    schedulePersist([]);
  },
  initialize: async () => {
    const jobs = await loadActiveJobs();
    set({ activeJobs: jobs });
  },
}));

if (!globalWithListener.__darwinityActiveJobsListenerRegistered__) {
  AppState.addEventListener('change', (state) => {
    if (state === 'background' || state === 'inactive') {
      flushPersist();
    }
  });
  globalWithListener.__darwinityActiveJobsListenerRegistered__ = true;
}
