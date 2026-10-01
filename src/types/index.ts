export interface User {
  id: number;
  email: string;
  name: string;
  phoneNo?: string;
  preferredLanguage?: string;
  college_name?: string;
  country?: string;
  countryCode?: string;
  category?: string;
  undergraduateCourse?: string | null;
  graduateProgram?: string | null;
  graduateProgramOtherDesc?: string | null;
  graduateCourse?: string | null;
  middleSchoolInterest?: string | null;
  highSchoolInterest?: string | null;
  professionalSector?: string | null;
  professionalSectorOtherDesc?: string | null;
  otherBackgroundDesc?: string | null;
  acquisitionSource?: string | null;
}

export interface LoginResponse {
  token: string;
  tokenValid: boolean;
  userPresent: boolean;
  userId?: number;
  userEmail?: string;
  college?: {
    name: string;
  };
}

export interface Content {
  id: number;
  title: string;
  content_type: 'PDF' | 'YOUTUBE' | 'AUDIO_RECORDING';
  source_key: string;
  created_at: string;
  updated_at: string;
  summary?: any;
  flashcards?: any;
  quiz?: any;
}

export interface JobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'blocked' | 'upgrade_required';
  message: string;
  progress?: number;
  result?: any;
  error_message?: string;
  user_message?: string;
}
