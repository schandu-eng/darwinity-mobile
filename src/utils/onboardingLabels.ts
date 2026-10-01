export const CATEGORY_LABELS: Record<string, string> = {
  UNDERGRADUATE: 'Undergraduate',
  GRADUATE: 'Graduate',
  MIDDLE_SCHOOL: 'Middle School',
  HIGH_SCHOOL: 'High School',
  WORKING_PROFESSIONAL: 'Working Professional',
  OTHERS: 'Others',
};

export const GRADUATE_PROGRAM_LABELS: Record<string, string> = {
  PROFESSIONAL_DEGREE: 'Professional Degree (Law / Medical / Architecture / etc.)',
  MASTERS_PROGRAM: "Master's Program",
  PHD_RESEARCH: 'PhD / Research',
  OTHERS: 'Others',
};

export const SECTOR_LABELS: Record<string, string> = {
  HEALTHCARE_MEDICAL: 'Medical',
  ENGINEERING_TECHNOLOGY: 'Engineering',
  EDUCATION_TRAINING: 'Teaching',
  INDUSTRIAL_MANUFACTURING: 'Industrial',
  BUSINESS_FINANCE: 'Business & Finance',
  LEGAL: 'Legal',
  ARTS_DESIGN: 'Arts & Design',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  CONSTRUCTION_PROPERTY: 'Construction & Property',
  SCIENCE_RESEARCH: 'Science & Research',
  HOSPITALITY_TOURISM: 'Hospitality & Tourism',
  GOVERNMENT_PUBLIC_SECTOR: 'Government & Public Sector',
  RETAIL_SALES: 'Retail & Sales',
  AGRICULTURE_ENVIRONMENT: 'Agriculture & Environment',
  TRANSPORTATION_LOGISTICS: 'Transportation & Logistics',
  MEDIA_COMMUNICATIONS: 'Media & Communications',
  OTHERS: 'Others',
};

export const ACQUISITION_LABELS: Record<string, string> = {
  INSTAGRAM: 'Instagram',
  META: 'Meta',
  X: 'X',
  LINKEDIN: 'LinkedIn',
  GOOGLE_SEARCH: 'Google Search',
  YOUTUBE: 'YouTube',
  AI_TOOLS: 'AI Tools (ChatGPT, Gemini, Claude)',
  FRIEND_OR_FAMILY: 'Friend or Family',
  TEACHER_OR_PROFESSOR: 'Teacher or Professor',
};

export type ProfileContextField = { label: string; value: string; pill?: boolean };

type ProfileLike = {
  name?: string | null;
  email?: string | null;
  country?: string | null;
  college_name?: string | null;
  category?: string | null;
  preferredLanguage?: string | null;
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
};

function hasTrimmed(value?: string | null): boolean {
  return Boolean(typeof value === 'string' ? value.trim() : value);
}

function hasStudyFocus(details: ProfileLike | null | undefined): boolean {
  if (!details) return false;
  return [
    details.undergraduateCourse,
    details.graduateCourse,
    details.graduateProgram,
    details.graduateProgramOtherDesc,
    details.middleSchoolInterest,
    details.highSchoolInterest,
    details.professionalSector,
    details.professionalSectorOtherDesc,
    details.otherBackgroundDesc,
    details.college_name,
  ].some(hasTrimmed);
}

export function getProfileContextFields(details: ProfileLike | null | undefined): ProfileContextField[] {
  if (!details) return [];

  const fields: ProfileContextField[] = [];
  const category = details.category;

  if (category) {
    fields.push({
      label: 'Purpose',
      value: CATEGORY_LABELS[category] || category,
    });
  }

  switch (category) {
    case 'UNDERGRADUATE':
      if (details.college_name) fields.push({ label: 'School', value: details.college_name });
      if (details.undergraduateCourse) {
        fields.push({ label: 'Course', value: details.undergraduateCourse, pill: true });
      }
      break;
    case 'GRADUATE':
      if (details.college_name) fields.push({ label: 'School', value: details.college_name });
      if (details.graduateProgram) {
        fields.push({
          label: 'Program',
          value: GRADUATE_PROGRAM_LABELS[details.graduateProgram] || details.graduateProgram,
        });
      }
      if (details.graduateProgram === 'OTHERS' && details.graduateProgramOtherDesc) {
        fields.push({ label: 'Program details', value: details.graduateProgramOtherDesc });
      }
      if (details.graduateCourse) {
        fields.push({ label: 'Course', value: details.graduateCourse, pill: true });
      }
      break;
    case 'MIDDLE_SCHOOL':
      if (details.middleSchoolInterest) {
        fields.push({ label: 'Interest', value: details.middleSchoolInterest });
      }
      break;
    case 'HIGH_SCHOOL':
      if (details.highSchoolInterest) {
        fields.push({ label: 'Interest', value: details.highSchoolInterest });
      }
      break;
    case 'WORKING_PROFESSIONAL':
      if (details.professionalSector) {
        fields.push({
          label: 'Sector',
          value: SECTOR_LABELS[details.professionalSector] || details.professionalSector,
        });
      }
      if (details.professionalSector === 'OTHERS' && details.professionalSectorOtherDesc) {
        fields.push({ label: 'Sector details', value: details.professionalSectorOtherDesc });
      }
      break;
    case 'OTHERS':
      if (details.otherBackgroundDesc) {
        fields.push({ label: 'Background', value: details.otherBackgroundDesc });
      }
      break;
    default:
      break;
  }

  if (details.acquisitionSource) {
    fields.push({
      label: 'How you found us',
      value: ACQUISITION_LABELS[details.acquisitionSource] || details.acquisitionSource,
    });
  }

  return fields;
}

export function getProfileCompletion(details: ProfileLike | null | undefined) {
  if (!details) {
    return {
      percent: 0,
      filled: 0,
      total: 0,
      items: [] as Array<{ id: string; label: string; done: boolean }>,
      missing: [] as Array<{ id: string; label: string; done: boolean }>,
      isComplete: false,
    };
  }

  const items = [
    { id: 'name', label: 'Name', done: hasTrimmed(details.name) },
    { id: 'email', label: 'Email', done: hasTrimmed(details.email) },
    { id: 'country', label: 'Country', done: hasTrimmed(details.country) },
    { id: 'language', label: 'Language', done: hasTrimmed(details.preferredLanguage) },
    { id: 'category', label: 'Purpose', done: hasTrimmed(details.category) },
    { id: 'focus', label: 'Study focus', done: hasStudyFocus(details) },
    { id: 'source', label: 'How you found us', done: hasTrimmed(details.acquisitionSource) },
  ];

  const filled = items.filter((item) => item.done).length;
  const total = items.length;

  return {
    percent: total === 0 ? 0 : Math.round((filled / total) * 100),
    filled,
    total,
    items,
    missing: items.filter((item) => !item.done),
    isComplete: filled === total && total > 0,
  };
}

export function getInitials(name?: string | null): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (parts[0]?.[0] || 'U').toUpperCase();
}
