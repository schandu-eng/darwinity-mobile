export const DOCUMENT_PICKER_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const DOCUMENT_INPUT_ACCEPT = '.pdf,.ppt,.pptx,.doc,.docx';

export const DOCUMENT_UPLOAD_ERROR = 'Please select a PDF, Word, or PowerPoint file';
export const DOCUMENT_UPLOAD_SUBTITLE = 'PDF, slides, or Word';

export const isAllowedDocumentUpload = (filename: string | undefined | null): boolean => {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return ['.pdf', '.ppt', '.pptx', '.doc', '.docx'].some((ext) => lower.endsWith(ext));
};
