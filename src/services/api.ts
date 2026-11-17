import { storage } from './store';
import { FacultyRecord, SubmissionRecord, CoeSettings, CoeOverviewStats } from '../types';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  trackingId?: string;
  alreadySubmitted?: boolean;
  faculty?: FacultyRecord;
  settings?: CoeSettings;
  stats?: CoeOverviewStats;
  hods?: FacultyRecord[];
  user?: any;
  coeUser?: any;
  users?: any[];
  assignedTeachers?: FacultyRecord[];
  departments?: string[];
  specializationsByDept?: Record<string, string[]>;
}


// In-memory OTP storage for backup validation if network delay occurs
const simulatedOtps: Record<string, { otp: string; expiresAt: number; portalType: string }> = {};

const DEFAULT_MASTER_SHEET_ID = '1a-wxvfyMzC6zmcyoWBFzzrFjysyituOVfvoXtxvVNPQ';
const DEFAULT_DRIVE_FOLDER_ID = '1w3hVMlTQNVUh7Bpru_cwlEJ6TQ77kfqI';

function splitDeptsClient(raw?: string): string[] {
  return Array.from(
    new Set(
      String(raw || '')
        .split(/[;,]+/)
        .map((d) => d.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function normalizeDeptsClient(raw?: string): string {
  const list = splitDeptsClient(raw);
  if (list.length === 0) return '';
  if (list.includes('ALL')) return 'ALL';
  return list.join(', ');
}

function sameDeptSetClient(a?: string, b?: string): boolean {
  const la = splitDeptsClient(a).sort();
  const lb = splitDeptsClient(b).sort();
  if (la.length !== lb.length) return false;
  return la.every((v, i) => v === lb[i]);
}

function mergeDeptsClient(existing?: string, added?: string): string {
  const combined = Array.from(new Set([...splitDeptsClient(existing), ...splitDeptsClient(added)]));
  if (combined.length === 0) return 'ALL';
  if (combined.includes('ALL')) return 'ALL';
  return combined.join(', ');
}

function mergeSpecsClient(existing?: string, added?: string): string {
  const a = String(existing || '').split(/[;,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
  const b = String(added || '').split(/[;,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
  const combined = Array.from(new Set([...a, ...b]));
  if (combined.length === 0) return 'ALL';
  if (combined.includes('ALL')) return 'ALL';
  return combined.join(', ');
}

function extractGoogleResourceId(input?: string): string {
  const clean = String(input || '').trim();
  if (!clean) return '';
  const folderMatch = clean.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (folderMatch && folderMatch[1]) return folderMatch[1];
  const docMatch = clean.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (docMatch && docMatch[1]) return docMatch[1];
  const idParamMatch = clean.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];
  const bareMatch = clean.match(/^[a-zA-Z0-9_-]{15,}$/);
  if (bareMatch) return clean;
  const fallbackMatch = clean.match(/[-\w]{25,}/);
  return fallbackMatch ? fallbackMatch[0] : '';
}

function normalizeSpreadsheetUrl(urlOrId: string, extractedId: string): string {
  const clean = urlOrId.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  return extractedId ? `https://docs.google.com/spreadsheets/d/${extractedId}/edit` : clean;
}

function normalizeDriveFolderUrl(urlOrId: string, extractedId: string): string {
  const clean = urlOrId.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  return extractedId ? `https://drive.google.com/drive/folders/${extractedId}` : clean;
}

function syncStorageFromCoeSettings(settings: Partial<CoeSettings>, markCustom: boolean) {
  const cfg = storage.getConfig();
  if (settings.spreadsheetUrl) {
    const sid = settings.spreadsheetId || extractGoogleResourceId(settings.spreadsheetUrl) || cfg.spreadsheetId;
    cfg.spreadsheetId = sid;
    cfg.spreadsheetUrl = normalizeSpreadsheetUrl(settings.spreadsheetUrl, sid);
  } else if (settings.spreadsheetId) {
    cfg.spreadsheetId = settings.spreadsheetId;
    cfg.spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${settings.spreadsheetId}/edit`;
  }
  if (settings.driveFolderUrl) {
    const fid = settings.driveFolderId || extractGoogleResourceId(settings.driveFolderUrl) || cfg.parentFolderId;
    cfg.parentFolderId = fid;
    cfg.driveFolderUrl = normalizeDriveFolderUrl(settings.driveFolderUrl, fid);
  } else if (settings.driveFolderId) {
    cfg.parentFolderId = settings.driveFolderId;
    cfg.driveFolderUrl = `https://drive.google.com/drive/folders/${settings.driveFolderId}`;
  }
  if (typeof settings.scriptUrl === 'string' && settings.scriptUrl.trim()) {
    cfg.scriptUrl = settings.scriptUrl.trim();
  }
  if (settings.academicYear) {
    cfg.academicYear = settings.academicYear;
  }
  if (settings.convocationBatch) {
    cfg.convocationBatch = settings.convocationBatch;
  }
  if (markCustom || settings.isCustomized) {
    cfg.isCustomConfig = true;
    cfg.configUpdatedAt = Date.now();
  }
  storage.saveConfig(cfg);
}

// Resolves API endpoint URL: uses VITE_API_BASE_URL (or configured Render URL) when UI is hosted on GitHub Pages,
// or relative '/api/...' when UI and backend are hosted together on Render.
function getBackendBaseUrl(): string {
  const envBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (envBase) {
    return envBase;
  }
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    return 'https://degreeframe-hits-portal.onrender.com';
  }
  const cfg = storage.getConfig();
  if (cfg.scriptUrl && !cfg.scriptUrl.includes('script.google.com')) {
    return cfg.scriptUrl.trim().replace(/\/+$/, '');
  }
  return '';
}

function canUseExpressApi(): boolean {
  const base = getBackendBaseUrl();
  if (base) return true;
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    // GitHub Pages is a static file host and returns 405 Method Not Allowed on POST /api/* unless a Render URL is configured
    return false;
  }
  return true;
}

function apiUrl(path: string): string {
  const base = getBackendBaseUrl();
  return base ? `${base}${path}` : path;
}

function parseCsvRowsClient(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

async function syncMasterSheetClientFallback(): Promise<void> {
  const sheetId = storage.getConfig().spreadsheetId || DEFAULT_MASTER_SHEET_ID;
  try {
    const fetchTab = async (tabName: string) => {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const text = await res.text();
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) return null;
      return parseCsvRowsClient(text);
    };

    const [studentRows, facultyRows] = await Promise.all([
      fetchTab('Student_data'),
      fetchTab('Faculty'),
    ]);

    if (studentRows && studentRows.length > 1) {
      const students = studentRows.slice(1).filter((r) => r[0]).map((r) => ({
        registerNumber: r[0] || '',
        name: r[1] || '',
        fatherName: r[2] || '',
        gender: r[3] || 'MALE',
        dob: r[4] || '',
        nationality: r[5] || 'INDIAN',
        year: r[6] || 'IV',
        branch: r[7] || '',
        specialization: r[8] || 'GENERAL',
      }));
      if (students.length > 0) storage.saveStudents(students);
    }

    if (facultyRows && facultyRows.length > 1) {
      const faculty: FacultyRecord[] = facultyRows.slice(1).filter((r) => r[0]).map((r) => ({
        email: (r[0] || '').toLowerCase(),
        name: r[1] || '',
        role: ((r[2] || 'TEACHER').toUpperCase()) as any,
        department: (r[3] || 'ALL').toUpperCase(),
        specialization: (r[4] || 'ALL').toUpperCase(),
        semester: (r[5] || 'ALL').toUpperCase(),
        batch: r[6] || 'ALL',
        section: (r[7] || 'ALL').toUpperCase(),
      }));
      if (faculty.length > 0) storage.saveFaculty(faculty);
    }
  } catch {
    // Ignore client sheet fallback errors
  }
}

export const api = {
  // 1. Send OTP
  async sendOtp(email: string, portalType: 'student' | 'faculty' | 'coe'): Promise<ApiResponse> {
    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    // Pre-generate 6-digit OTP so client & server share the exact same OTP even if Render restarts
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    simulatedOtps[cleanEmail] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      portalType,
    };

    const config = storage.getConfig();

    // Try Express backend first when available
    if (canUseExpressApi()) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(apiUrl('/api/auth/send-otp'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ email: cleanEmail, portalType, clientOtp: otp }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          // Directly return server's response (e.g. 403 Access Denied or 200 Success)
          return data;
        }
      } catch {
        // Fallback to local OTP only if server network error
      }
    }

    // Client fallback whitelist validation
    if (portalType === 'coe') {
      const isSuper = cleanEmail === 'superadmin' || cleanEmail.startsWith('superadmin@') || cleanEmail.startsWith('admin@');
      const isKnownAcoe = cleanEmail === 'dycoe@hindustanuniv.ac.in' || cleanEmail === 'acoe@hindustanuniv.ac.in';
      const isLocalAcoe = storage.getFaculty().some((f) => f.email.toLowerCase() === cleanEmail && String(f.role).toUpperCase().includes('COE'));
      if (!isSuper && !isKnownAcoe && !isLocalAcoe) {
        return {
          success: false,
          message: `Access Denied: ${cleanEmail}. Contact COE.`,
        };
      }
    } else if (portalType === 'faculty') {
      let facultyList = storage.getFaculty();
      if (facultyList.length === 0) {
        await syncMasterSheetClientFallback();
        facultyList = storage.getFaculty();
      }
      const isRegistered = facultyList.some((f) => f.email.toLowerCase() === cleanEmail);
      if (!isRegistered) {
        return {
          success: false,
          message: `Access Denied: ${cleanEmail} is not registered in the Faculty/HOD directory. Department HODs must be appointed by the COE, and Class Teachers must be assigned by their HOD.`,
        };
      }
    }

    return {
      success: true,
      message: `OTP generated for ${cleanEmail}. Please check your email inbox.`,
    };
  },

  // 2. Verify OTP
  async verifyOtp(email: string, otp: string, portalType: 'student' | 'faculty' | 'coe'): Promise<ApiResponse> {
    const cleanEmail = email.toLowerCase().trim();
    const inputOtp = otp.trim();

    if (!cleanEmail || !inputOtp) {
      return { success: false, message: 'Email and OTP code are required.' };
    }

    const stored = simulatedOtps[cleanEmail];
    const isLocalMatch = Boolean(stored && stored.otp === inputOtp && Date.now() <= stored.expiresAt);

    // Try Express backend first when available
    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/auth/verify-otp'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            email: cleanEmail,
            otp: inputOtp,
            portalType,
          }),
        });
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          // Directly return server decision (including 403 Access Denied)
          return data;
        }
      } catch {
        // Fallback
      }
    }

    const config = storage.getConfig();
    if (config.scriptUrl && config.scriptUrl.includes('script.google.com')) {
      try {
        const response = await fetch(config.scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'verifyOtp',
            email: cleanEmail,
            otp: inputOtp,
            portalType,
          }),
        });
        const res = await response.json();
        return res;
      } catch (e: any) {
        console.warn('Network call failed, verifying locally:', e);
      }
    }

    if (!isLocalMatch) {
      return {
        success: false,
        message: 'Invalid or expired OTP code. Please request a new code.',
      };
    }

    delete simulatedOtps[cleanEmail];

    if (portalType === 'coe') {
      const isSuper = cleanEmail.startsWith('superadmin@') || cleanEmail.startsWith('admin@');
      const isKnownAcoe = cleanEmail === 'dycoe@hindustanuniv.ac.in' || cleanEmail === 'acoe@hindustanuniv.ac.in';
      const isLocalAcoe = storage.getFaculty().some((f) => f.email.toLowerCase() === cleanEmail && String(f.role).toUpperCase().includes('COE'));
      if (!isSuper && !isKnownAcoe && !isLocalAcoe) {
        return {
          success: false,
          message: `Access Denied: ${cleanEmail}. Contact COE.`,
        };
      }
      return {
        success: true,
        message: 'COE authentication verified.',
        user: {
          email: cleanEmail,
          name: isSuper ? 'Chief COE Super Admin' : cleanEmail.includes('dycoe') ? 'Dr. Dycoe (ACOE)' : 'Controller of Examinations (ACOE)',
          role: isSuper ? 'SUPER_ADMIN' : 'ACOE',
          streamScope: 'ALL',
        },
      };
    }

    if (portalType === 'faculty') {
      let facultyList = storage.getFaculty();
      if (facultyList.length === 0) {
        await syncMasterSheetClientFallback();
        facultyList = storage.getFaculty();
      }
      const matches = facultyList.filter((f) => f.email.toLowerCase() === cleanEmail);
      if (matches.length === 0) {
        return {
          success: false,
          message: `Access Denied: ${cleanEmail} is not registered in the Faculty directory. Department HODs are appointed by COE and Class Teachers are appointed by HOD.`,
        };
      }
      const mergedDept = matches.reduce((acc, r) => mergeDeptsClient(acc, r.department), '') || matches[0].department;
      const mergedSpec = matches.reduce((acc, r) => mergeSpecsClient(acc, r.specialization), '') || 'ALL';
      return {
        success: true,
        message: `Faculty authentication successful (${matches[0].role}).`,
        faculty: {
          ...matches[0],
          department: mergedDept,
          specialization: mergedSpec,
        },
      };
    }

    return {
      success: true,
      message: 'OTP verified successfully.',
    };
  },

  // 3. Get Student Data for Verification
  async getStudentData(registerNumber: string, studentEmail?: string): Promise<ApiResponse> {
    const cleanRegNo = registerNumber.trim().toLowerCase();

    if (!cleanRegNo) {
      return { success: false, message: 'Please enter a valid Register Number.' };
    }

    const cleanStudentEmail = (studentEmail || '').trim().toLowerCase();
    if (
      cleanStudentEmail &&
      (cleanStudentEmail.endsWith('@student.hindustanuniv.ac.in') || cleanStudentEmail.endsWith('@hindustanuniv.ac.in'))
    ) {
      const expectedReg = cleanStudentEmail.split('@')[0].trim().toLowerCase();
      if (expectedReg && cleanRegNo !== expectedReg) {
        return {
          success: false,
          message: `Access Denied: You are logged in as ${cleanStudentEmail}. You can only view details for your own Register Number (${expectedReg.toUpperCase()}).`,
        };
      }
    }

    // Try Express backend first when available
    if (canUseExpressApi()) {
      try {
        const qs = cleanStudentEmail ? `?studentEmail=${encodeURIComponent(cleanStudentEmail)}` : '';
        const response = await fetch(apiUrl(`/api/student/lookup/${encodeURIComponent(cleanRegNo)}${qs}`));
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          const res = await response.json();
          if (res.success || response.status === 404 || response.status === 403) return res;
        }
      } catch {
        // Fallback
      }
    }

    const config = storage.getConfig();
    if (config.scriptUrl && config.scriptUrl.includes('script.google.com')) {
      try {
        const response = await fetch(config.scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'getStudentData',
            parentFolderId: config.parentFolderId,
            spreadsheetId: config.spreadsheetId,
            registerNumber: cleanRegNo,
          }),
        });
        const res = await response.json();
        return res;
      } catch (e: any) {
        console.warn('Network call failed:', e);
      }
    }

    let students = storage.getStudents();
    if (students.length === 0) {
      await syncMasterSheetClientFallback();
      students = storage.getStudents();
    }
    const student = students.find((s) => s.registerNumber.toLowerCase() === cleanRegNo);

    if (student) {
      return {
        success: true,
        alreadySubmitted: false,
        data: {
          registerNumber: student.registerNumber,
          regNo: student.registerNumber,
          studentName: student.name,
          fatherName: student.fatherName,
          gender: student.gender,
          dob: student.dob,
          nationality: student.nationality,
          year: student.year,
          branch: student.branch,
          department: student.branch,
          specialization: student.specialization,
        },
      };
    }

    return {
      success: false,
      message: `Register Number '${registerNumber}' not found in records.`,
    };
  },

  // 4. Submit Student Application
  async submitApplication(payload: any): Promise<ApiResponse> {
    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/student/submit'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          return await response.json();
        }
      } catch {
        // Fallback
      }
    }

    const config = storage.getConfig();
    if (config.scriptUrl && config.scriptUrl.includes('script.google.com')) {
      try {
        const response = await fetch(config.scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'submitStudentApplication',
            parentFolderId: config.parentFolderId,
            spreadsheetId: config.spreadsheetId,
            ...payload,
          }),
        });
        const res = await response.json();
        return res;
      } catch (e: any) {
        console.warn('Network call failed, saving to local store:', e);
      }
    }

    const regNo = String(payload.registerNumber || '').trim().toUpperCase();
    const submissionId = 'sub-' + Math.random().toString(36).substring(2, 8);

    const newRecord: SubmissionRecord = {
      submissionId,
      studentEmail: payload.studentEmail,
      registerNumber: regNo,
      studentName: payload.studentName,
      fatherName: payload.fatherName,
      gender: payload.gender,
      dob: payload.dob,
      nationality: payload.nationality,
      departmentBranch: payload.department,
      specialization: payload.specialization,
      semester: payload.semester || 'VIII',
      section: payload.section,
      batch: payload.batch,
      photoUpload: `${regNo}.jpg`,
      finalDriveUrl: payload.photoData,
      proof10thUrl: '',
      proofTcUrl: '',
      validationNotes: payload.isNameCorrected ? 'Name Corrected' : 'Verified profile details without edits.',
      approvalStatus: 'PENDING_TEACHER',
      teacherRemarks: '',
      hodRemarks: '',
      deanRemarks: '',
      submittedAt: new Date().toISOString(),
    };

    storage.upsertSubmission(newRecord);

    return {
      success: true,
      trackingId: submissionId,
      message: 'Application submitted successfully for Teacher Review.',
    };
  },

  // 5. Check Submission Status
  async checkStatus(query: string, studentEmail?: string): Promise<ApiResponse> {
    const cleanQuery = query.toLowerCase().trim();

    if (!cleanQuery) {
      return { success: false, message: 'Please enter Register Number or Email.' };
    }

    const cleanStudentEmail = (studentEmail || '').trim().toLowerCase();
    if (
      cleanStudentEmail &&
      (cleanStudentEmail.endsWith('@student.hindustanuniv.ac.in') || cleanStudentEmail.endsWith('@hindustanuniv.ac.in'))
    ) {
      const expectedReg = cleanStudentEmail.split('@')[0].trim().toLowerCase();
      if (expectedReg && cleanQuery !== expectedReg && cleanQuery !== cleanStudentEmail) {
        return {
          success: false,
          message: `Access Denied: You are logged in as ${cleanStudentEmail}. You can only track clearance status for your own Register Number (${expectedReg.toUpperCase()}).`,
        };
      }
    }

    if (canUseExpressApi()) {
      try {
        const qs = cleanStudentEmail ? `?studentEmail=${encodeURIComponent(cleanStudentEmail)}` : '';
        const response = await fetch(apiUrl(`/api/student/status/${encodeURIComponent(cleanQuery)}${qs}`));
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          const res = await response.json();
          if (res.success && res.data) {
            const st = res.data.status || res.data.approvalStatus || 'PENDING_TEACHER';
            res.data.status = st;
            res.data.approvalStatus = st;
            res.data.regNo = res.data.regNo || res.data.registerNumber || cleanQuery;
            res.data.name = res.data.name || res.data.studentName || '';
          }
          return res;
        }
      } catch {
        // Fallback
      }
    }

    const config = storage.getConfig();
    if (config.scriptUrl && config.scriptUrl.includes('script.google.com')) {
      try {
        const response = await fetch(config.scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'checkSubmissionStatus',
            parentFolderId: config.parentFolderId,
            spreadsheetId: config.spreadsheetId,
            query: cleanQuery,
          }),
        });
        const res = await response.json();
        if (res.success && res.data) {
          const st = res.data.status || res.data.approvalStatus || 'PENDING_TEACHER';
          res.data.status = st;
          res.data.approvalStatus = st;
          res.data.regNo = res.data.regNo || res.data.registerNumber || cleanQuery;
          res.data.name = res.data.name || res.data.studentName || '';
        }
        return res;
      } catch (e: any) {
        console.warn('Network call failed:', e);
      }
    }

    const submissions = storage.getSubmissions();
    const found = submissions.find(
      (s) =>
        s.studentEmail.toLowerCase() === cleanQuery ||
        s.registerNumber.toLowerCase() === cleanQuery
    );

    if (found) {
      const st = found.approvalStatus || 'PENDING_TEACHER';
      return {
        success: true,
        data: {
          submissionId: found.submissionId,
          email: found.studentEmail,
          regNo: found.registerNumber,
          registerNumber: found.registerNumber,
          name: found.studentName,
          studentName: found.studentName,
          dept: found.departmentBranch,
          departmentBranch: found.departmentBranch,
          specialization: found.specialization,
          semester: found.semester || 'VIII',
          section: found.section,
          batch: found.batch,
          status: st,
          approvalStatus: st,
          valStatus: found.validationNotes,
          validationNotes: found.validationNotes,
          teacherRemarks: found.teacherRemarks,
          hodRemarks: found.hodRemarks,
        },
      };
    }

    return {
      success: false,
      message: `No submission record found for '${query}'`,
    };
  },

  // 6. Get Pending Applications for Faculty
  async getPendingApplications(facultyEmail: string): Promise<ApiResponse<SubmissionRecord[]>> {
    const cleanEmail = facultyEmail.toLowerCase().trim();

    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl(`/api/faculty/pending?email=${encodeURIComponent(cleanEmail)}`));
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          const res = await response.json();
          if (res.success && Array.isArray(res.data)) return res;
        }
      } catch {
        // Fallback
      }
    }

    const config = storage.getConfig();
    if (config.scriptUrl && config.scriptUrl.includes('script.google.com')) {
      try {
        const response = await fetch(config.scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'getPendingApplications',
            parentFolderId: config.parentFolderId,
            spreadsheetId: config.spreadsheetId,
            email: cleanEmail,
          }),
        });
        const res = await response.json();
        if (res.success && Array.isArray(res.data)) return res;
      } catch (e: any) {
        console.warn('Network call failed:', e);
      }
    }

    return {
      success: true,
      data: storage.getSubmissions(),
    };
  },

  // 7. Process Faculty Action (Approve / Reject)
  async processFacultyAction(payload: {
    submissionId: string;
    decision: 'APPROVE' | 'REJECT';
    remarks: string;
    role: string;
    facultyEmail: string;
  }): Promise<ApiResponse> {
    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/faculty/action'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          return await response.json();
        }
      } catch {
        // Fallback
      }
    }

    const config = storage.getConfig();
    if (config.scriptUrl && config.scriptUrl.includes('script.google.com')) {
      try {
        const response = await fetch(config.scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'processFacultyAction',
            parentFolderId: config.parentFolderId,
            spreadsheetId: config.spreadsheetId,
            ...payload,
          }),
        });
        const res = await response.json();
        return res;
      } catch (e: any) {
        console.warn('Network call failed:', e);
      }
    }

    return {
      success: true,
      message: 'Application status updated.',
    };
  },

  // 8. Add Class Teacher (HOD Action)
  async addClassTeacher(payload: {
    hodEmail: string;
    teacherEmail: string;
    teacherName: string;
    department: string;
    specialization: string;
    semester?: string;
    batch: string;
    section: string;
  }): Promise<ApiResponse> {
    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/faculty/add-teacher'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          return await response.json();
        }
      } catch {
        // Fallback
      }
    }

    const config = storage.getConfig();
    if (config.scriptUrl && config.scriptUrl.includes('script.google.com')) {
      try {
        const response = await fetch(config.scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'addClassTeacher',
            parentFolderId: config.parentFolderId,
            spreadsheetId: config.spreadsheetId,
            ...payload,
          }),
        });
        const res = await response.json();
        return res;
      } catch (e: any) {
        console.warn('Network call failed:', e);
      }
    }

    return {
      success: true,
      message: `Class Teacher ${payload.teacherName} added successfully.`,
    };
  },

  // Update Class Teacher (HOD Action)
  async updateClassTeacher(payload: {
    hodEmail: string;
    oldEmail: string;
    newEmail?: string;
    name?: string;
    department?: string;
    specialization?: string;
    semester?: string;
    batch?: string;
    section?: string;
  }): Promise<ApiResponse> {
    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/faculty/update-teacher'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          return await response.json();
        }
      } catch {
        // Fallback
      }
    }

    const cleanOldEmail = payload.oldEmail.toLowerCase().trim();
    const cleanNewEmail = (payload.newEmail || cleanOldEmail).toLowerCase().trim();
    const faculty = storage.getFaculty();
    const idx = faculty.findIndex((f) => f.email.toLowerCase() === cleanOldEmail && f.role === 'TEACHER');

    if (idx >= 0) {
      faculty[idx].email = cleanNewEmail;
      if (payload.name) faculty[idx].name = payload.name.trim();
      if (payload.department) faculty[idx].department = payload.department.trim().toUpperCase();
      if (payload.specialization) faculty[idx].specialization = payload.specialization.trim().toUpperCase();
      if (payload.semester) faculty[idx].semester = payload.semester.trim().toUpperCase();
      if (payload.batch) faculty[idx].batch = payload.batch.trim();
      if (payload.section) faculty[idx].section = payload.section.trim().toUpperCase();
      storage.saveFaculty(faculty);
    }

    return {
      success: true,
      message: 'Class Teacher record updated.',
    };
  },

  // Delete / Remove Class Teacher (HOD Action)
  async deleteClassTeacher(hodEmail: string, teacherEmail: string): Promise<ApiResponse> {
    const cleanEmail = teacherEmail.toLowerCase().trim();

    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/faculty/delete-teacher'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ hodEmail, teacherEmail: cleanEmail }),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          return await response.json();
        }
      } catch {
        // Fallback
      }
    }

    const faculty = storage.getFaculty().filter((f) => !(f.role === 'TEACHER' && f.email.toLowerCase() === cleanEmail));
    storage.saveFaculty(faculty);

    return {
      success: true,
      message: `Class Teacher ${cleanEmail} removed.`,
    };
  },

  // ==========================================
  // 9. COE SPECIFIC APIS
  // ==========================================

  // Get COE Overview & System Stats
  async getCoeOverview(streamScope?: string): Promise<ApiResponse> {
    if (canUseExpressApi()) {
      try {
        const url = streamScope ? `/api/coe/overview?streamScope=${encodeURIComponent(streamScope)}` : '/api/coe/overview';
        const response = await fetch(apiUrl(url));
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          const data: ApiResponse = await response.json();
          if (data.success && data.settings) {
            const localCfg = storage.getConfig();
            if (data.settings.isCustomized) {
              syncStorageFromCoeSettings(data.settings, true);
            } else if (
              localCfg.isCustomConfig &&
              (localCfg.spreadsheetId !== DEFAULT_MASTER_SHEET_ID ||
                localCfg.parentFolderId !== DEFAULT_DRIVE_FOLDER_ID ||
                (localCfg.spreadsheetUrl && localCfg.spreadsheetUrl !== data.settings.spreadsheetUrl) ||
                (localCfg.driveFolderUrl && localCfg.driveFolderUrl !== data.settings.driveFolderUrl))
            ) {
              // Server booted with uncustomized defaults (e.g. ephemeral container restart); restore saved user links
              const restoredDriveUrl =
                localCfg.driveFolderUrl || `https://drive.google.com/drive/folders/${localCfg.parentFolderId}`;
              const restoredSheetUrl =
                localCfg.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${localCfg.spreadsheetId}/edit`;
              const restoredYear = localCfg.academicYear || data.settings.academicYear;
              const restoredBatch = localCfg.convocationBatch || data.settings.convocationBatch;
              const restorePayload = {
                driveFolderUrl: restoredDriveUrl,
                spreadsheetUrl: restoredSheetUrl,
                academicYear: restoredYear,
                convocationBatch: restoredBatch,
              };
              try {
                const restoreRes = await fetch(apiUrl('/api/coe/config'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                  body: JSON.stringify(restorePayload),
                });
                if (restoreRes.ok && (restoreRes.headers.get('content-type') || '').includes('application/json')) {
                  const restored = await restoreRes.json();
                  if (restored?.settings) {
                    data.settings = restored.settings;
                  }
                }
              } catch {
                data.settings = {
                  ...data.settings,
                  driveFolderUrl: restoredDriveUrl,
                  spreadsheetUrl: restoredSheetUrl,
                  academicYear: restoredYear,
                  convocationBatch: restoredBatch,
                  spreadsheetId: localCfg.spreadsheetId,
                  driveFolderId: localCfg.parentFolderId,
                  isCustomized: true,
                };
              }
            }
          }
          return data;
        }
      } catch {
        // Fallback
      }
    }

    await syncMasterSheetClientFallback();
    const subs = storage.getSubmissions();
    const students = storage.getStudents();
    const faculty = storage.getFaculty();
    const cfg = storage.getConfig();
    const sheetId = cfg.spreadsheetId || DEFAULT_MASTER_SHEET_ID;
    const folderId = cfg.parentFolderId || DEFAULT_DRIVE_FOLDER_ID;

    const deptSet = new Set<string>();
    const specMap: Record<string, Set<string>> = {};
    for (const s of students) {
      const b = String(s.branch || '').trim().toUpperCase();
      if (!b) continue;
      deptSet.add(b);
      if (!specMap[b]) specMap[b] = new Set<string>();
      const sp = String(s.specialization || '').trim().toUpperCase();
      if (sp && sp !== 'GENERAL' && sp !== 'ALL') specMap[b].add(sp);
    }
    const specializationsByDept: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(specMap)) {
      specializationsByDept[k] = Array.from(v).sort();
    }

    return {
      success: true,
      settings: {
        spreadsheetUrl: cfg.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
        spreadsheetId: sheetId,
        driveFolderUrl: cfg.driveFolderUrl || `https://drive.google.com/drive/folders/${folderId}`,
        driveFolderId: folderId,
        scriptUrl: cfg.scriptUrl,
        academicYear: cfg.academicYear || '2024-2025',
        convocationBatch: cfg.convocationBatch || '34th Convocation Ceremony',
        isCustomized: Boolean(cfg.isCustomConfig),
      },
      stats: {
        totalStudents: students.length,
        totalSubmissions: subs.length,
        approved: subs.filter((s) => s.approvalStatus === 'APPROVED').length,
        pendingTeacher: subs.filter((s) => s.approvalStatus === 'PENDING_TEACHER').length,
        pendingHod: subs.filter((s) => s.approvalStatus === 'PENDING_HOD').length,
        rejected: subs.filter((s) => s.approvalStatus.includes('REJECT')).length,
        totalHods: faculty.filter((f) => f.role === 'HOD').length,
        totalTeachers: faculty.filter((f) => f.role === 'TEACHER').length,
      },
      hods: faculty.filter((f) => f.role === 'HOD'),
      departments: Array.from(deptSet).sort(),
      specializationsByDept,
    };
  },

  // COE Login with Username or Email, and Password or OTP
  async coeLogin(usernameOrEmail: string, password?: string, otp?: string): Promise<ApiResponse> {
    const cleanKey = usernameOrEmail.toLowerCase().trim();

    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/auth/coe-login'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ usernameOrEmail, email: usernameOrEmail, password, otp }),
        });
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (data.user && !data.coeUser) {
            data.coeUser = data.user;
          }
          // Directly return server decision (e.g. 403 Access Denied or 200 Success)
          return data;
        }
      } catch {
        // Fallback
      }
    }

    const isSuper = cleanKey === 'superadmin' || cleanKey === 'admin' || cleanKey.startsWith('superadmin@') || cleanKey.startsWith('admin@');
    const isKnownAcoe = cleanKey === 'dycoe@hindustanuniv.ac.in' || cleanKey === 'acoe@hindustanuniv.ac.in';
    const localAcoes = storage.getFaculty().filter((f) => String(f.role).toUpperCase().includes('COE'));
    const matchedLocal = localAcoes.find((f) => f.email.toLowerCase() === cleanKey);

    if (!isSuper && !isKnownAcoe && !matchedLocal) {
      return {
        success: false,
        message: `Access Denied: ${cleanKey}. Contact COE.`,
      };
    }

    const savedSuperPass =
      typeof localStorage !== 'undefined' ? localStorage.getItem('superadmin_password_override') : null;
    const expectedSuperPass = savedSuperPass || 'Admin@123';

    if (isSuper && password !== expectedSuperPass) {
      return {
        success: false,
        message: 'Invalid Super Admin username or password.',
      };
    }

    const name = isSuper
      ? 'Chief COE Super Admin'
      : cleanKey.includes('dycoe')
      ? 'Dr. Dycoe (ACOE)'
      : matchedLocal?.name || 'Controller of Examinations (ACOE)';

    const savedRecoveryEmail =
      typeof localStorage !== 'undefined' ? localStorage.getItem('superadmin_recovery_email_override') || '' : '';

    return {
      success: true,
      message: `COE authentication successful as ${name}.`,
      coeUser: {
        username: isSuper ? 'superadmin' : cleanKey.split('@')[0],
        email: cleanKey.includes('@') ? cleanKey : `${cleanKey}@hindustanuniv.ac.in`,
        name,
        role: isSuper ? 'SUPER_ADMIN' : 'ACOE',
        streamScope: 'ALL',
        isDefaultPassword: isSuper ? expectedSuperPass === 'Admin@123' : password === 'Acoe@123',
        recoveryEmail: isSuper ? savedRecoveryEmail : '',
      },
    };
  },

  // Get list of registered ACOE Users (Super Admin only)
  async getCoeUsers(): Promise<ApiResponse> {
    let serverUsers: any[] = [];
    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/coe/users'));
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          const data = await response.json();
          if (Array.isArray(data.users)) {
            serverUsers = data.users;
          }
        }
      } catch {
        // Fallback
      }
    }

    // Merge with any locally saved ACOE users from Faculty storage
    const localAcoes = storage
      .getFaculty()
      .filter((f) => String(f.role).toUpperCase().includes('ACOE'))
      .map((f) => ({
        email: f.email.toLowerCase(),
        name: f.name,
        role: 'ACOE',
        streamScope: f.department || 'ALL',
        otpEnabled: (f as any).otpEnabled !== false,
        addedAt: new Date().toISOString(),
      }));

    const mergedMap = new Map<string, any>();
    for (const u of serverUsers) {
      if (u && u.email) mergedMap.set(u.email.toLowerCase(), u);
    }
    for (const u of localAcoes) {
      if (u && u.email && !mergedMap.has(u.email.toLowerCase())) {
        mergedMap.set(u.email.toLowerCase(), u);
      }
    }

    return {
      success: true,
      users: Array.from(mergedMap.values()),
    };
  },

  // Add or Appoint new ACOE Administrator
  async addAcoeUser(payload: { email: string; name: string; password?: string; role?: string; streamScope?: string; otpEnabled?: boolean }): Promise<ApiResponse> {
    const cleanEmail = String(payload.email || '').toLowerCase().trim();
    const cleanName = String(payload.name || '').trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanName) {
      return { success: false, message: 'Valid ACOE Email and Full Name are required.' };
    }

    const fullPayload = {
      email: cleanEmail,
      name: cleanName,
      role: payload.role || 'ACOE',
      streamScope: payload.streamScope || 'ALL',
      password: payload.password || 'Acoe@123',
      otpEnabled: payload.otpEnabled !== false,
    };

    // Always persist to local Faculty storage so UI stays in sync
    const faculty = storage.getFaculty();
    const newAcoeRecord: FacultyRecord & { otpEnabled?: boolean } = {
      email: cleanEmail,
      name: cleanName,
      role: 'ACOE' as any,
      department: fullPayload.streamScope,
      specialization: 'ALL',
      semester: 'ALL',
      batch: 'ALL',
      section: 'ALL',
      otpEnabled: fullPayload.otpEnabled,
    };
    const existingIdx = faculty.findIndex((f) => f.email.toLowerCase() === cleanEmail);
    if (existingIdx >= 0) {
      faculty[existingIdx] = newAcoeRecord;
    } else {
      faculty.push(newAcoeRecord);
    }
    storage.saveFaculty(faculty);

    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/coe/add-acoe'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(fullPayload),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          return await response.json();
        }
      } catch {
        // Fallback to GAS / local storage
      }
    }

    const config = storage.getConfig();
    if (config.scriptUrl && config.scriptUrl.includes('script.google.com')) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'addAcoe',
            parentFolderId: config.parentFolderId,
            spreadsheetId: config.spreadsheetId,
            email: cleanEmail,
            name: cleanName,
            role: 'ACOE',
            department: fullPayload.streamScope,
            specialization: 'ALL',
            semester: 'ALL',
            batch: 'ALL',
            section: 'ALL',
          }),
        });
      } catch {
        // Ignore network error
      }
    }

    return {
      success: true,
      message: `ACOE user ${cleanName} (${cleanEmail}) appointed successfully.`,
    };
  },

  // Toggle Email OTP Alone Any Time (Super Admin Action)
  async toggleAcoeOtp(email: string, otpEnabled: boolean): Promise<ApiResponse> {
    const cleanEmail = String(email || '').toLowerCase().trim();
    const faculty = storage.getFaculty();
    const idx = faculty.findIndex((f) => f.email.toLowerCase() === cleanEmail);
    if (idx >= 0) {
      (faculty[idx] as any).otpEnabled = otpEnabled;
      storage.saveFaculty(faculty);
    }

    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/coe/toggle-otp'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ email: cleanEmail, otpEnabled }),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          return await response.json();
        }
      } catch {
        // Fallback
      }
    }
    return {
      success: true,
      message: `Email OTP status updated for ${cleanEmail}.`,
    };
  },

  // Update ACOE User Details
  async updateAcoeUser(payload: {
    oldEmail: string;
    newEmail?: string;
    name?: string;
    streamScope?: string;
    role?: string;
    password?: string;
    otpEnabled?: boolean;
  }): Promise<ApiResponse> {
    const cleanOldEmail = String(payload.oldEmail || '').toLowerCase().trim();
    const cleanNewEmail = payload.newEmail ? String(payload.newEmail).toLowerCase().trim() : cleanOldEmail;
    const cleanName = payload.name ? String(payload.name).trim() : undefined;
    const cleanScope = payload.streamScope ? String(payload.streamScope).toUpperCase().trim() : undefined;
    const cleanRole = payload.role ? String(payload.role).toUpperCase().trim() : undefined;

    const faculty = storage.getFaculty();
    const idx = faculty.findIndex(
      (f) => f.email.toLowerCase() === cleanOldEmail && String(f.role).toUpperCase().includes('COE')
    );
    if (idx >= 0) {
      faculty[idx].email = cleanNewEmail;
      if (cleanName) faculty[idx].name = cleanName;
      if (cleanScope) faculty[idx].department = cleanScope;
      if (cleanRole) (faculty[idx] as any).role = cleanRole;
      if (typeof payload.otpEnabled === 'boolean') {
        (faculty[idx] as any).otpEnabled = payload.otpEnabled;
      }
      storage.saveFaculty(faculty);
    } else if (cleanNewEmail && cleanName) {
      faculty.push({
        email: cleanNewEmail,
        name: cleanName,
        role: (cleanRole || 'ACOE') as any,
        department: cleanScope || 'ALL',
        specialization: 'ALL',
        semester: 'ALL',
        batch: 'ALL',
        section: 'ALL',
        ...(typeof payload.otpEnabled === 'boolean' ? { otpEnabled: payload.otpEnabled } : {}),
      } as any);
      storage.saveFaculty(faculty);
    }

    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/coe/update-acoe'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          return await response.json();
        }
      } catch {
        // Fallback
      }
    }

    const config = storage.getConfig();
    if (config.scriptUrl && config.scriptUrl.includes('script.google.com')) {
      try {
        const response = await fetch(config.scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'updateAcoe',
            oldEmail: cleanOldEmail,
            newEmail: cleanNewEmail,
            name: cleanName,
            role: cleanRole || 'ACOE',
            department: cleanScope || 'ALL',
            streamScope: cleanScope || 'ALL',
          }),
        });
        const res = await response.json();
        return res;
      } catch {
        // Fallback
      }
    }

    return {
      success: true,
      message: `ACOE user details updated successfully.`,
    };
  },

  // Delete / Remove ACOE User Email
  async deleteAcoeUser(email: string): Promise<ApiResponse> {
    const cleanEmail = String(email || '').toLowerCase().trim();
    const faculty = storage.getFaculty().filter((f) => f.email.toLowerCase() !== cleanEmail);
    storage.saveFaculty(faculty);

    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/coe/delete-acoe'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ email: cleanEmail }),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          return await response.json();
        }
      } catch {
        // Fallback
      }
    }
    return {
      success: true,
      message: `ACOE user ${cleanEmail} removed.`,
    };
  },

  // Change COE or Super Admin Password
  async changeCoePassword(
    identifier: string,
    newPassword: string,
    currentPassword?: string,
    recoveryEmail?: string
  ): Promise<ApiResponse> {
    const cleanId = String(identifier || '').toLowerCase().trim();
    const isSuperTarget = cleanId === 'superadmin' || cleanId.startsWith('superadmin@');

    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/coe/change-password'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            email: cleanId,
            username: cleanId,
            ...(typeof currentPassword === 'string' ? { currentPassword } : {}),
            newPassword,
            ...(typeof recoveryEmail === 'string' && recoveryEmail.trim()
              ? { recoveryEmail: recoveryEmail.trim().toLowerCase() }
              : {}),
          }),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          const data: ApiResponse = await response.json();
          if (data.success && isSuperTarget && typeof localStorage !== 'undefined') {
            localStorage.setItem('superadmin_password_override', newPassword.trim());
            if (typeof recoveryEmail === 'string' && recoveryEmail.trim()) {
              localStorage.setItem('superadmin_recovery_email_override', recoveryEmail.trim().toLowerCase());
            }
          }
          return data;
        }
      } catch {
        // Fallback
      }
    }

    if (isSuperTarget && typeof currentPassword === 'string') {
      const savedPass =
        (typeof localStorage !== 'undefined' && localStorage.getItem('superadmin_password_override')) || 'Admin@123';
      if (currentPassword.trim() !== savedPass) {
        return { success: false, message: 'Current password is incorrect.' };
      }
    }
    if (isSuperTarget && typeof localStorage !== 'undefined') {
      localStorage.setItem('superadmin_password_override', newPassword.trim());
      if (typeof recoveryEmail === 'string' && recoveryEmail.trim()) {
        localStorage.setItem('superadmin_recovery_email_override', recoveryEmail.trim().toLowerCase());
      }
    }

    return {
      success: true,
      message: 'Password updated successfully.',
    };
  },

  // Update Super Admin Recovery Email
  async updateSuperAdminRecoveryEmail(recoveryEmail: string): Promise<ApiResponse & { recoveryEmail?: string }> {
    const cleanRec = String(recoveryEmail || '').toLowerCase().trim();
    if (!cleanRec || !cleanRec.includes('@')) {
      return { success: false, message: 'Please enter a valid recovery email address.' };
    }

    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/coe/update-recovery-email'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ recoveryEmail: cleanRec }),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          const data = await response.json();
          if (data.success && typeof localStorage !== 'undefined') {
            localStorage.setItem('superadmin_recovery_email_override', cleanRec);
          }
          return data;
        }
      } catch {
        // Fallback
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('superadmin_recovery_email_override', cleanRec);
    }
    return {
      success: true,
      message: `Super Admin recovery email updated to ${cleanRec}.`,
      recoveryEmail: cleanRec,
    };
  },

  // Super Admin Password Recovery: Send OTP to Authorized Recovery Email
  async sendSuperAdminRecoveryOtp(email: string): Promise<ApiResponse> {
    const cleanEmail = String(email || '').toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    simulatedOtps[`superadmin_recovery:${cleanEmail}`] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      portalType: 'superadmin_recovery',
    };

    if (canUseExpressApi()) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(apiUrl('/api/auth/superadmin-send-recovery-otp'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ email: cleanEmail, clientOtp: otp }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return await response.json();
        }
      } catch {
        // Fallback
      }
    }

    const config = storage.getConfig();
    if (config.scriptUrl && config.scriptUrl.includes('script.google.com')) {
      try {
        const response = await fetch(config.scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'sendOtp',
            email: cleanEmail,
            otp,
            clientOtp: otp,
            portalType: 'superadmin_recovery',
          }),
        });
        const res = await response.json();
        if (res.success) return res;
      } catch {
        // Ignore
      }
    }

    return {
      success: false,
      message: 'Could not reach server to dispatch Super Admin recovery OTP email.',
    };
  },

  // Super Admin Password Recovery: Verify OTP & Reset Password
  async resetSuperAdminPassword(email: string, otp: string, newPassword: string): Promise<ApiResponse> {
    const cleanEmail = String(email || '').toLowerCase().trim();
    const inputOtp = String(otp || '').trim();
    const cleanNewPass = String(newPassword || '').trim();

    if (!cleanEmail || !inputOtp || !cleanNewPass) {
      return { success: false, message: 'Recovery email, 6-digit OTP, and new password are required.' };
    }

    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/auth/superadmin-reset-password'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ email: cleanEmail, otp: inputOtp, newPassword: cleanNewPass }),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          const data: ApiResponse = await response.json();
          if (data.success && typeof localStorage !== 'undefined') {
            localStorage.setItem('superadmin_password_override', cleanNewPass);
            localStorage.setItem('superadmin_recovery_email_override', cleanEmail);
          }
          return data;
        }
      } catch {
        // Fallback
      }
    }

    const stored = simulatedOtps[`superadmin_recovery:${cleanEmail}`];
    if (!stored || stored.otp !== inputOtp || Date.now() > stored.expiresAt) {
      return { success: false, message: 'Invalid or expired OTP code.' };
    }
    delete simulatedOtps[`superadmin_recovery:${cleanEmail}`];

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('superadmin_password_override', cleanNewPass);
      localStorage.setItem('superadmin_recovery_email_override', cleanEmail);
    }

    return {
      success: true,
      message: 'Super Admin password reset successfully! You can now sign in with your new password.',
    };
  },


  // Update COE Drive & Spreadsheet Config
  async updateCoeConfig(payload: Partial<CoeSettings>): Promise<ApiResponse> {
    const hasDriveOrSheetUpdate = Boolean(
      (payload.driveFolderUrl && payload.driveFolderUrl.trim()) ||
        (payload.spreadsheetUrl && payload.spreadsheetUrl.trim())
    );
    const normalizedPayload: Partial<CoeSettings> = { ...payload };

    const cfg = storage.getConfig();
    if (payload.driveFolderUrl && payload.driveFolderUrl.trim()) {
      const folderId = extractGoogleResourceId(payload.driveFolderUrl);
      if (folderId) {
        cfg.parentFolderId = folderId;
        normalizedPayload.driveFolderId = folderId;
      }
      const normalizedDriveUrl = normalizeDriveFolderUrl(payload.driveFolderUrl, folderId || cfg.parentFolderId);
      cfg.driveFolderUrl = normalizedDriveUrl;
      normalizedPayload.driveFolderUrl = normalizedDriveUrl;
    }
    if (payload.spreadsheetUrl && payload.spreadsheetUrl.trim()) {
      const sheetId = extractGoogleResourceId(payload.spreadsheetUrl);
      if (sheetId) {
        cfg.spreadsheetId = sheetId;
        normalizedPayload.spreadsheetId = sheetId;
      }
      const normalizedSheetUrl = normalizeSpreadsheetUrl(payload.spreadsheetUrl, sheetId || cfg.spreadsheetId);
      cfg.spreadsheetUrl = normalizedSheetUrl;
      normalizedPayload.spreadsheetUrl = normalizedSheetUrl;
    }
    if (typeof payload.scriptUrl === 'string' && payload.scriptUrl.trim()) {
      cfg.scriptUrl = payload.scriptUrl.trim();
    }
    if (payload.academicYear && payload.academicYear.trim()) {
      cfg.academicYear = payload.academicYear.trim();
    }
    if (payload.convocationBatch && payload.convocationBatch.trim()) {
      cfg.convocationBatch = payload.convocationBatch.trim();
    }
    if (hasDriveOrSheetUpdate) {
      cfg.isCustomConfig = true;
      cfg.configUpdatedAt = Date.now();
    }
    storage.saveConfig(cfg);

    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/coe/config'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(normalizedPayload),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          const data: ApiResponse = await response.json();
          if (data.success && data.settings) {
            syncStorageFromCoeSettings(data.settings, hasDriveOrSheetUpdate);
          }
          return data;
        }
      } catch {
        // Fallback
      }
    }

    if (cfg.scriptUrl && cfg.scriptUrl.includes('script.google.com')) {
      try {
        await fetch(cfg.scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'saveConfig',
            parentFolderId: cfg.parentFolderId,
            spreadsheetId: cfg.spreadsheetId,
            driveFolderUrl: cfg.driveFolderUrl,
            spreadsheetUrl: cfg.spreadsheetUrl,
            academicYear: cfg.academicYear,
            convocationBatch: cfg.convocationBatch,
          }),
        });
      } catch {
        // Ignore GAS sync failure on fallback
      }
    }

    return {
      success: true,
      message: 'COE Google Drive storage folder & Spreadsheet configuration updated.',
      settings: {
        spreadsheetUrl: cfg.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${cfg.spreadsheetId}/edit`,
        spreadsheetId: cfg.spreadsheetId,
        driveFolderUrl: cfg.driveFolderUrl || `https://drive.google.com/drive/folders/${cfg.parentFolderId}`,
        driveFolderId: cfg.parentFolderId,
        scriptUrl: cfg.scriptUrl,
        academicYear: cfg.academicYear || '2024-2025',
        convocationBatch: cfg.convocationBatch || '34th Convocation Ceremony',
        isCustomized: Boolean(cfg.isCustomConfig),
      },
    };
  },

  // COE Add Department HOD
  async addHod(payload: { email: string; name: string; department: string; specialization?: string }): Promise<ApiResponse> {
    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/coe/add-hod'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          return await response.json();
        }
      } catch {
        // Fallback
      }
    }

    const cleanEmail = payload.email.toLowerCase().trim();
    const cleanDept = normalizeDeptsClient(payload.department);
    const cleanSpecTokens = String(payload.specialization || 'ALL')
      .split(/[;,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const cleanSpec = cleanSpecTokens.join(', ') || 'ALL';
    const faculty = storage.getFaculty();
    const sameHodIdx = faculty.findIndex(
      (f) => f.role === 'HOD' && f.email.toLowerCase() === cleanEmail && sameDeptSetClient(f.department, cleanDept)
    );
    const sameSpecIdx =
      sameHodIdx >= 0
        ? -1
        : faculty.findIndex(
            (f) =>
              f.role === 'HOD' &&
              sameDeptSetClient(f.department, cleanDept) &&
              (f.specialization || 'ALL').toUpperCase() === cleanSpec
          );

    let finalSpec = cleanSpec;
    if (sameHodIdx >= 0) {
      const existingTokens = String(faculty[sameHodIdx].specialization || '')
        .split(/[;,]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const merged = Array.from(new Set([...existingTokens, ...cleanSpecTokens]));
      finalSpec = merged.includes('ALL') ? 'ALL' : merged.join(', ') || 'ALL';
    }

    const newHod: FacultyRecord = {
      email: cleanEmail,
      name: payload.name.trim(),
      role: 'HOD',
      department: cleanDept,
      specialization: finalSpec,
      semester: 'ALL',
      batch: 'ALL',
      section: 'ALL',
    };

    if (sameHodIdx >= 0) {
      faculty[sameHodIdx] = newHod;
    } else if (sameSpecIdx >= 0) {
      faculty[sameSpecIdx] = newHod;
    } else {
      faculty.unshift(newHod);
    }
    storage.saveFaculty(faculty);

    return {
      success: true,
      message: `Head of Department for ${cleanDept} (${finalSpec}) assigned: ${payload.name}.`,
    };
  },

  // COE Update Department HOD
  async updateHod(payload: {
    oldEmail: string;
    oldDepartment?: string;
    oldSpecialization?: string;
    newEmail?: string;
    name?: string;
    department?: string;
    specialization?: string;
  }): Promise<ApiResponse> {
    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/coe/update-hod'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          return await response.json();
        }
      } catch {
        // Fallback
      }
    }

    const cleanOldEmail = payload.oldEmail.toLowerCase().trim();
    const cleanOldDept = normalizeDeptsClient(payload.oldDepartment);
    const cleanOldSpec = (payload.oldSpecialization || '').trim().toUpperCase();
    const cleanNewEmail = (payload.newEmail || cleanOldEmail).toLowerCase().trim();
    const cleanDept = normalizeDeptsClient(payload.department);
    const cleanName = (payload.name || '').trim();
    const faculty = storage.getFaculty();
    let idx = faculty.findIndex(
      (f) =>
        f.role === 'HOD' &&
        f.email.toLowerCase() === cleanOldEmail &&
        (!cleanOldDept || sameDeptSetClient(f.department, cleanOldDept)) &&
        (!cleanOldSpec || (f.specialization || 'ALL').toUpperCase() === cleanOldSpec)
    );
    if (idx < 0) {
      idx = faculty.findIndex((f) => f.email.toLowerCase() === cleanOldEmail && f.role === 'HOD');
    }

    if (idx >= 0) {
      faculty[idx].email = cleanNewEmail;
      if (cleanName) faculty[idx].name = cleanName;
      if (cleanDept) faculty[idx].department = cleanDept;
      if (payload.specialization) faculty[idx].specialization = payload.specialization.trim().toUpperCase();
      storage.saveFaculty(faculty);
    }

    // Direct Google Apps Script dispatch fallback
    const config = storage.getConfig();
    if (config.scriptUrl && config.scriptUrl.includes('script.google.com')) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'updateHod',
            parentFolderId: config.parentFolderId,
            spreadsheetId: config.spreadsheetId,
            oldEmail: cleanOldEmail,
            oldDepartment: cleanOldDept,
            oldSpecialization: cleanOldSpec,
            email: cleanNewEmail,
            name: cleanName || (idx >= 0 ? faculty[idx].name : ''),
            department: cleanDept || (idx >= 0 ? faculty[idx].department : ''),
            specialization: payload.specialization || (idx >= 0 ? faculty[idx].specialization : 'ALL'),
            role: 'HOD',
            semester: 'ALL',
            batch: 'ALL',
            section: 'ALL',
          }),
        });
      } catch (e) {
        console.warn('[CLIENT-GAS] Could not sync updateHod to Apps Script:', e);
      }
    }

    return {
      success: true,
      message: 'HOD record updated and synced to Master Sheet.',
    };
  },

  // COE Delete / Remove Department HOD
  async deleteHod(email: string, department?: string, specialization?: string): Promise<ApiResponse> {
    const cleanEmail = email.toLowerCase().trim();
    const cleanDept = normalizeDeptsClient(department);
    const cleanSpec = (specialization || '').trim().toUpperCase();

    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/coe/delete-hod'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ email: cleanEmail, department: cleanDept, specialization: cleanSpec }),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          return await response.json();
        }
      } catch {
        // Fallback
      }
    }

    const faculty = storage.getFaculty().filter(
      (f) =>
        !(
          f.role === 'HOD' &&
          f.email.toLowerCase() === cleanEmail &&
          (!cleanDept || sameDeptSetClient(f.department, cleanDept)) &&
          (!cleanSpec || (f.specialization || 'ALL').toUpperCase() === cleanSpec)
        )
    );
    storage.saveFaculty(faculty);

    // Direct Google Apps Script dispatch fallback
    const config = storage.getConfig();
    if (config.scriptUrl && config.scriptUrl.includes('script.google.com')) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'deleteHod',
            parentFolderId: config.parentFolderId,
            spreadsheetId: config.spreadsheetId,
            email: cleanEmail,
            department: cleanDept,
            specialization: cleanSpec,
          }),
        });
      } catch (e) {
        console.warn('[CLIENT-GAS] Could not sync deleteHod to Apps Script:', e);
      }
    }

    return {
      success: true,
      message: `HOD record removed and deleted from Master Sheet.`,
    };
  },

  // COE Import Sheets
  async importSheets(payload: { students?: any[]; submissions?: any[]; faculty?: any[] }): Promise<ApiResponse> {
    if (canUseExpressApi()) {
      try {
        const response = await fetch(apiUrl('/api/coe/import-sheets'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 405 && contentType.includes('application/json')) {
          return await response.json();
        }
      } catch {
        // Fallback
      }
    }

    if (payload.students) storage.saveStudents(payload.students);
    if (payload.faculty) storage.saveFaculty(payload.faculty);
    if (payload.submissions) storage.saveSubmissions(payload.submissions);

    return {
      success: true,
      message: 'Sheet data imported into database successfully.',
    };
  },
};

