import { StudentRecord, SubmissionRecord, FacultyRecord } from '../types';

export const DEFAULT_STUDENTS: StudentRecord[] = [];
export const DEFAULT_FACULTY: FacultyRecord[] = [];
export const DEFAULT_SUBMISSIONS: SubmissionRecord[] = [];

const STORAGE_KEYS = {
  STUDENTS: 'df_students_data_v2',
  FACULTY: 'df_faculty_data_v2',
  SUBMISSIONS: 'df_submissions_data_v2',
  CONFIG: 'df_config_v2',
};

export interface AppConfig {
  scriptUrl: string;
  useLiveScript: boolean;
  spreadsheetId: string;
  spreadsheetUrl?: string;
  parentFolderId: string;
  driveFolderUrl?: string;
  academicYear?: string;
  convocationBatch?: string;
  isCustomConfig?: boolean;
  configUpdatedAt?: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  scriptUrl: 'https://script.google.com/macros/s/AKfycbwFHBlRVUWt06sCFEGRuR0B7aKvGQgt6mNDaeU9xJE/exec',
  useLiveScript: true,
  spreadsheetId: '1a-wxvfyMzC6zmcyoWBFzzrFjysyituOVfvoXtxvVNPQ',
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1a-wxvfyMzC6zmcyoWBFzzrFjysyituOVfvoXtxvVNPQ/edit',
  parentFolderId: '1w3hVMlTQNVUh7Bpru_cwlEJ6TQ77kfqI',
  driveFolderUrl: 'https://drive.google.com/drive/folders/1w3hVMlTQNVUh7Bpru_cwlEJ6TQ77kfqI',
  academicYear: '2024-2025',
  convocationBatch: '34th Convocation Ceremony',
  isCustomConfig: false,
  configUpdatedAt: 0,
};

class StorageService {
  getStudents(): StudentRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveStudents(students: StudentRecord[]) {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  }

  getFaculty(): FacultyRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.FACULTY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveFaculty(faculty: FacultyRecord[]) {
    localStorage.setItem(STORAGE_KEYS.FACULTY, JSON.stringify(faculty));
  }

  addFacultyMember(member: FacultyRecord) {
    const list = this.getFaculty();
    list.push(member);
    this.saveFaculty(list);
  }

  getSubmissions(): SubmissionRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveSubmissions(submissions: SubmissionRecord[]) {
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
  }

  upsertSubmission(sub: SubmissionRecord) {
    const list = this.getSubmissions();
    const idx = list.findIndex(
      (s) => s.registerNumber.toLowerCase() === sub.registerNumber.toLowerCase()
    );
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...sub, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({ ...sub, submittedAt: new Date().toISOString() });
    }
    this.saveSubmissions(list);
  }

  getConfig(): AppConfig {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!raw) return DEFAULT_CONFIG;
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  saveConfig(config: AppConfig) {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  }

  resetToDefault() {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.FACULTY, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(DEFAULT_CONFIG));
  }
}

export const storage = new StorageService();
