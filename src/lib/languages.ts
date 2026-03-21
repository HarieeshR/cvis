export type LanguageId = 'c' | 'java' | 'python';

export interface LanguageOption {
  id: LanguageId;
  label: string;
  shortLabel: string;
  extension: string;
  enabled: boolean;
  status: 'ready' | 'soon';
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    id: 'c',
    label: 'C',
    shortLabel: 'C',
    extension: 'c',
    enabled: true,
    status: 'ready'
  },
  {
    id: 'java',
    label: 'Java',
    shortLabel: 'Java',
    extension: 'java',
    enabled: false,
    status: 'soon'
  },
  {
    id: 'python',
    label: 'Python',
    shortLabel: 'Py',
    extension: 'py',
    enabled: false,
    status: 'soon'
  }
];

export function getLanguageOption(language: LanguageId): LanguageOption {
  return LANGUAGE_OPTIONS.find((option) => option.id === language) ?? LANGUAGE_OPTIONS[0];
}
