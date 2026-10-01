import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppStackParamList>;
};

export type AuthStackParamList = {
  Login: undefined;
  VerifyEmail: { email: string };
  Signup: { email: string; token: string };
  OnboardingIdentity: undefined;
  OnboardingDetails: undefined;
  OnboardingLanguage: undefined;
  OnboardingCountry: undefined;
  OnboardingSource: undefined;
};

export type HomeTabParamList = {
  HomeFeed: { subscriptionLimitMessage?: string; error?: string } | undefined;
  StudyStats: undefined;
  ExamPrep: NavigatorScreenParams<ExamPrepStackParamList> | undefined;
  Productivity: NavigatorScreenParams<ProductivityStackParamList> | undefined;
};

export type ExamPrepStackParamList = {
  ExamPrepHub: undefined;
  ExamPrepTarget: { targetId: number; autostart?: boolean };
};

export type ProductivityStackParamList = {
  ProductivityHome: undefined;
  FocusShieldAppPicker: undefined;
};

export type AppStackParamList = {
  Home: NavigatorScreenParams<HomeTabParamList> | undefined;
  Content: NavigatorScreenParams<ContentStackParamList>;
  CardReel: undefined;
  ContentMenuModal: { contentId: number };
  RenameNoteModal: { contentId: number; currentTitle: string };
  ExportModal: { contentId: number; type: 'pdf' | 'audio' };
  AddToFolderModal: { contentId: number };
  StudyAlarmRing: undefined;
  AccountModal: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type AppTabParamList = HomeTabParamList;

export type OnboardingStackParamList = {
  Welcome: undefined;
  Trail: undefined;
  Arrive: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Settings: undefined;
  AccountDetails: undefined;
  ChangeLanguage: undefined;
  HelpSupport: undefined;
  About: undefined;
  BillingPlanSettings: undefined;
  Upgrade: undefined;
  RewardsInbox: undefined;
  StudyStats: undefined;
};

export type ContentStackParamList = {
  ContentList: { error?: string };
  ContentDetail: { contentId: number; notesJobId?: string; initialTab?: 'notes' | 'flashcards' | 'quiz' | 'podcast' | 'games' };
  Folders: undefined;
  FolderDetail: { folderId: number; folderName?: string; error?: string };
  Upload: { error?: string };
  UploadProgress: {
    jobId: string;
    contentTitle?: string;
    sourceScreen?: 'YouTubeLink' | 'AudioRecording' | 'Home' | 'ContentList' | 'FolderDetail';
    folderId?: number;
  };
  YouTubeLink: { error?: string; folderId?: number };
  AudioRecording: { error?: string; folderId?: number };
  Chat: { contentId: number; selectedText?: string };
  NotesEditor: { contentId: number };
  Quiz: { contentId: number };
  Flashcards: { contentId: number };
  Podcast: { contentId: number };
  Flowchart: { contentId: number };
  Games: { contentId: number };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = {
  navigation: any;
  route: { params: RootStackParamList[T] };
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = {
  navigation: any;
  route: { params: AuthStackParamList[T] };
};

export type AppStackScreenProps<T extends keyof AppStackParamList> = {
  navigation: any;
  route: { params: AppStackParamList[T] };
};

export type AppTabScreenProps<T extends keyof AppTabParamList> = AppStackScreenProps<T>;

export type OnboardingStackScreenProps<T extends keyof OnboardingStackParamList> = {
  navigation: any;
  route: { params: OnboardingStackParamList[T] };
};
