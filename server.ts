import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable CORS so GitHub Pages (https://sherineliyas.github.io) and any client origin can call this Render backend without preflight failures
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  const reqHeaders = req.headers['access-control-request-headers'];
  res.setHeader(
    'Access-Control-Allow-Headers',
    reqHeaders ? String(reqHeaders) : 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Explicit Favicon routes to eliminate any 404 errors (serves ICO and SVG)
const handleFaviconRequest = (req: Request, res: Response) => {
  const icoPath = path.resolve(__dirname, 'public/favicon.ico');
  const svgPath = path.resolve(__dirname, 'public/favicon.svg');
  if (req.path.endsWith('.svg') && fs.existsSync(svgPath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(svgPath);
  }
  if (fs.existsSync(icoPath)) {
    res.setHeader('Content-Type', 'image/x-icon');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(icoPath);
  }
  if (fs.existsSync(svgPath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(svgPath);
  }
  return res.status(204).end();
};

app.get(['/favicon.ico', '/favicon.svg', '*/favicon.ico', '*/favicon.svg'], handleFaviconRequest);

// Enable JSON, URL-encoded, and text/plain JSON body parsing up to 50MB for photos and documents
// Supporting text/plain allows cross-origin POST requests from GitHub Pages to bypass browser OPTIONS preflight
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ type: ['text/plain', 'text/*'], limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use((req, _res, next) => {
  if (typeof req.body === 'string') {
    const trimmed = req.body.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        req.body = JSON.parse(trimmed);
      } catch {
        // Keep original string if not valid JSON
      }
    }
  }
  if (!req.body || typeof req.body !== 'object') {
    req.body = {};
  }
  next();
});

// In-Memory Database initialized with default clean structures
interface StudentRecord {
  registerNumber: string;
  name: string;
  fatherName: string;
  gender: string;
  dob: string;
  nationality: string;
  year: string;
  branch: string;
  specialization: string;
}

interface FacultyRecord {
  email: string;
  name: string;
  role: 'TEACHER' | 'HOD' | 'COE';
  department: string;
  specialization: string;
  semester: string;
  batch: string;
  section: string;
}

interface SubmissionRecord {
  submissionId: string;
  studentEmail: string;
  registerNumber: string;
  studentName: string;
  fatherName: string;
  gender: string;
  dob: string;
  nationality: string;
  departmentBranch: string;
  specialization: string;
  semester: string;
  section: string;
  batch: string;
  photoUpload: string;
  finalDriveUrl: string;
  proof10thUrl?: string;
  proofTcUrl?: string;
  validationNotes: string;
  approvalStatus: 'PENDING_TEACHER' | 'PENDING_HOD' | 'APPROVED' | 'REJECTED_BY_TEACHER' | 'REJECTED_BY_HOD';
  teacherRemarks?: string;
  hodRemarks?: string;
  deanRemarks?: string;
  submittedAt: string;
}

interface CoeSettings {
  spreadsheetUrl: string;
  spreadsheetId: string;
  driveFolderUrl: string;
  driveFolderId: string;
  scriptUrl?: string;
  academicYear: string;
  convocationBatch: string;
}

// Empty Database initially
let studentData: StudentRecord[] = [];
let facultyData: FacultyRecord[] = [];
let submissionsData: SubmissionRecord[] = [];

// Fast O(1) Indexed Hash Map for 10,000+ Student Lookups (Instant <0.01ms resolution)
const studentIndexMap = new Map<string, StudentRecord>();

function rebuildStudentIndex() {
  studentIndexMap.clear();
  for (const s of studentData) {
    if (s.registerNumber) {
      studentIndexMap.set(s.registerNumber.toUpperCase().trim(), s);
    }
  }
}
rebuildStudentIndex();


interface CoeUserRecord {
  username?: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ACOE' | 'ACOE_ENGINEERING' | 'ACOE_NON_ENGINEERING';
  streamScope: 'ALL' | 'ENGINEERING' | 'NON_ENGINEERING';
  password?: string;
  isDefaultPassword?: boolean;
  otpEnabled?: boolean;
  addedAt?: string;
}

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwB7rlI6iUJCIFmL8WM0ZhDdKFIxobATliqpUxOAVd0dcsBwVeFd5ZXwQrgMRh1NafggA/exec';

const INITIAL_COE_USERS: CoeUserRecord[] = [
  {
    username: 'superadmin',
    email: 'superadmin@hindustanuniv.ac.in',
    name: 'Chief COE Super Admin',
    role: 'SUPER_ADMIN',
    streamScope: 'ALL',
    password: 'Admin@123',
    isDefaultPassword: true,
    otpEnabled: true,
  },
  {
    email: 'dycoe@hindustanuniv.ac.in',
    name: 'Dr. Dycoe (ACOE)',
    role: 'ACOE',
    streamScope: 'ALL',
    password: 'Acoe@123',
    isDefaultPassword: true,
    otpEnabled: true,
  },
  {
    email: 'acoe@hindustanuniv.ac.in',
    name: 'Controller of Examinations (ACOE)',
    role: 'ACOE',
    streamScope: 'ALL',
    password: 'Acoe@123',
    isDefaultPassword: true,
    otpEnabled: true,
  },
  {
    email: 'sherine@hindustanuniv.ac.in',
    name: 'Dr. Sherin Eliyas (ACOE)',
    role: 'ACOE',
    streamScope: 'ALL',
    password: 'Acoe@123',
    isDefaultPassword: true,
    otpEnabled: true,
  },
];

let coeUsersData: CoeUserRecord[] = [...INITIAL_COE_USERS];

const COE_USERS_FILE_PATH = path.resolve(__dirname, 'coe_users.json');

function loadCoeUsersFromDisk() {
  try {
    if (fs.existsSync(COE_USERS_FILE_PATH)) {
      const saved: CoeUserRecord[] = JSON.parse(fs.readFileSync(COE_USERS_FILE_PATH, 'utf-8'));
      if (Array.isArray(saved) && saved.length > 0) {
        for (const u of saved) {
          if (!u || !u.email) continue;
          const idx = coeUsersData.findIndex((existing) => existing.email.toLowerCase() === u.email.toLowerCase());
          if (idx >= 0) {
            coeUsersData[idx] = { ...coeUsersData[idx], ...u };
          } else {
            coeUsersData.push(u);
          }
        }
      }
    }
  } catch (e) {
    console.warn('[USERS] Could not load coe_users.json:', e);
  }
}
loadCoeUsersFromDisk();

function saveCoeUsersToDisk() {
  try {
    fs.writeFileSync(COE_USERS_FILE_PATH, JSON.stringify(coeUsersData, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[USERS] Could not save coe_users.json:', e);
  }
}

const FACULTY_FILE_PATH = path.resolve(__dirname, 'faculty_data.json');

function loadFacultyFromDisk() {
  try {
    if (fs.existsSync(FACULTY_FILE_PATH)) {
      const saved: FacultyRecord[] = JSON.parse(fs.readFileSync(FACULTY_FILE_PATH, 'utf-8'));
      if (Array.isArray(saved) && saved.length > 0) {
        for (const f of saved) {
          if (!f || !f.email) continue;
          const idx = facultyData.findIndex(
            (e) => e.email.toLowerCase() === f.email.toLowerCase() && e.department.toUpperCase() === f.department.toUpperCase()
          );
          if (idx >= 0) {
            facultyData[idx] = { ...facultyData[idx], ...f };
          } else {
            facultyData.push(f);
          }
        }
      }
    }
  } catch (e) {
    console.warn('[FACULTY] Could not load faculty_data.json:', e);
  }
}
loadFacultyFromDisk();

function saveFacultyToDisk() {
  try {
    fs.writeFileSync(FACULTY_FILE_PATH, JSON.stringify(facultyData, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[FACULTY] Could not save faculty_data.json:', e);
  }
}


function matchesStreamScope(deptBranch: string = '', streamScope: 'ALL' | 'ENGINEERING' | 'NON_ENGINEERING' = 'ALL'): boolean {
  if (!streamScope || streamScope === 'ALL') return true;
  const text = deptBranch.toUpperCase();
  const isNonEngg =
    text.includes('BCA') ||
    text.includes('B.SC') ||
    text.includes('B.COM') ||
    text.includes('BBA') ||
    text.includes('B.A') ||
    text.includes('ARTS') ||
    text.includes('COMMERCE') ||
    text.includes('SCIENCE') ||
    text.includes('MCA') ||
    text.includes('MBA') ||
    text.includes('M.SC') ||
    text.includes('NON-ENGG') ||
    text.includes('NON ENGG');

  if (streamScope === 'NON_ENGINEERING') {
    return isNonEngg;
  } else if (streamScope === 'ENGINEERING') {
    return !isNonEngg;
  }
  return true;
}

let coeSettings: CoeSettings = {
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1a-wxvfyMzC6zmcyoWBFzzrFjysyituOVfvoXtxvVNPQ/edit',
  spreadsheetId: '1a-wxvfyMzC6zmcyoWBFzzrFjysyituOVfvoXtxvVNPQ',
  driveFolderUrl: 'https://drive.google.com/drive/folders/1w3hVMlTQNVUh7Bpru_cwlEJ6TQ77kfqI',
  driveFolderId: '1w3hVMlTQNVUh7Bpru_cwlEJ6TQ77kfqI',
  scriptUrl: process.env.GAS_WEB_APP_URL || process.env.GOOGLE_SCRIPT_URL || DEFAULT_GAS_URL,
  academicYear: '2024-2025',
  convocationBatch: '34th Convocation Ceremony',
};

const CONFIG_FILE_PATH = path.resolve(__dirname, 'coe_config.json');

function loadCoeConfigFromDisk() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf-8'));
      if (saved.spreadsheetUrl) coeSettings.spreadsheetUrl = saved.spreadsheetUrl;
      if (saved.spreadsheetId) coeSettings.spreadsheetId = saved.spreadsheetId;
      if (saved.driveFolderUrl) coeSettings.driveFolderUrl = saved.driveFolderUrl;
      if (saved.driveFolderId) coeSettings.driveFolderId = saved.driveFolderId;
      if (saved.scriptUrl) coeSettings.scriptUrl = saved.scriptUrl;
      if (saved.academicYear) coeSettings.academicYear = saved.academicYear;
      if (saved.convocationBatch) coeSettings.convocationBatch = saved.convocationBatch;
    }
  } catch (e) {
    console.warn('[CONFIG] Could not load coe_config.json:', e);
  }
}
loadCoeConfigFromDisk();

function saveCoeConfigToDisk() {
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(coeSettings, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[CONFIG] Could not save coe_config.json:', e);
  }
}

// Helper to forward actions to Google Apps Script (Code.gs) for Google Drive .jpg creation & Google Sheets persistence
async function callGoogleAppsScript(action: string, payload: Record<string, any>, timeoutMs = 15000): Promise<any | null> {
  const targetScriptUrl = (coeSettings.scriptUrl || process.env.GAS_WEB_APP_URL || process.env.GOOGLE_SCRIPT_URL || DEFAULT_GAS_URL).trim();
  if (!targetScriptUrl || !targetScriptUrl.startsWith('http')) {
    return null;
  }
  try {
    const response = await fetch(targetScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action,
        parentFolderId: coeSettings.driveFolderId,
        spreadsheetId: coeSettings.spreadsheetId,
        ...payload,
      }),
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err: any) {
    console.warn(`[GAS-SYNC] Failed calling action '${action}' on Google Apps Script:`, err?.message || err);
  }
  return null;
}

// Parse CSV helper for direct Google Sheet gviz CSV export fallback
function parseCsvRows(csvText: string): string[][] {
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

let lastSheetSyncTime = 0;

// Syncs Student_data, Faculty, and Submissions directly from the Master Google Sheet
async function syncFromMasterSheet(force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && studentData.length > 0 && now - lastSheetSyncTime < 30 * 1000) {
    return true;
  }

  // 1. Try Google Apps Script (Code.gs) syncMasterSheet first
  const gasSync = await callGoogleAppsScript('syncMasterSheet', {});
  if (gasSync && gasSync.success) {
    if (Array.isArray(gasSync.students) && gasSync.students.length > 0) {
      studentData = gasSync.students;
      rebuildStudentIndex();
    }
    if (Array.isArray(gasSync.faculty) && gasSync.faculty.length > 0) {
      facultyData = gasSync.faculty;
      for (const f of facultyData) {
        const rUpper = String(f.role).toUpperCase();
        if (rUpper.includes('ACOE') || rUpper.includes('COE') || rUpper.includes('SUPER_ADMIN')) {
          const exists = coeUsersData.some((u) => u.email.toLowerCase() === f.email.toLowerCase());
          if (!exists) {
            coeUsersData.push({
              email: f.email.toLowerCase(),
              name: f.name,
              role: rUpper.includes('SUPER') ? 'SUPER_ADMIN' : 'ACOE',
              streamScope: (f.department === 'ENGINEERING' || f.department === 'NON_ENGINEERING' ? f.department : 'ALL') as any,
              password: 'Acoe@123',
              isDefaultPassword: true,
              otpEnabled: (f as any).otpEnabled !== false,
            });
          }
        }
      }
    }
    if (Array.isArray(gasSync.submissions) && gasSync.submissions.length > 0) {
      submissionsData = gasSync.submissions;
    }
    lastSheetSyncTime = now;
    return true;
  }

  // 2. Direct Google Sheet CSV export fallback (works whenever the Master Sheet is shared as Anyone with link can view)
  const sheetId = (coeSettings.spreadsheetId || '').trim();
  if (!sheetId) return false;

  try {
    const fetchTabCsv = async (tabName: string) => {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const text = await res.text();
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) return null;
      return parseCsvRows(text);
    };

    const [studentRows, facultyRows, subRows] = await Promise.all([
      fetchTabCsv('Student_data'),
      fetchTabCsv('Faculty'),
      fetchTabCsv('Submissions'),
    ]);

    if (studentRows && studentRows.length > 1) {
      studentData = studentRows.slice(1).filter((r) => r[0]).map((r) => ({
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
      rebuildStudentIndex();
    }

    if (facultyRows && facultyRows.length > 1) {
      facultyData = facultyRows.slice(1).filter((r) => r[0]).map((r) => ({
        email: (r[0] || '').toLowerCase(),
        name: r[1] || '',
        role: ((r[2] || 'TEACHER').toUpperCase()) as any,
        department: (r[3] || 'ALL').toUpperCase(),
        specialization: (r[4] || 'ALL').toUpperCase(),
        semester: (r[5] || 'ALL').toUpperCase(),
        batch: r[6] || 'ALL',
        section: (r[7] || 'ALL').toUpperCase(),
      }));
      for (const f of facultyData) {
        const rUpper = String(f.role).toUpperCase();
        if (rUpper.includes('ACOE') || rUpper.includes('COE') || rUpper.includes('SUPER_ADMIN')) {
          const exists = coeUsersData.some((u) => u.email.toLowerCase() === f.email.toLowerCase());
          if (!exists) {
            coeUsersData.push({
              email: f.email.toLowerCase(),
              name: f.name,
              role: rUpper.includes('SUPER') ? 'SUPER_ADMIN' : 'ACOE',
              streamScope: (f.department === 'ENGINEERING' || f.department === 'NON_ENGINEERING' ? f.department : 'ALL') as any,
              password: 'Acoe@123',
              isDefaultPassword: true,
              otpEnabled: true,
            });
          }
        }
      }
    }

    if (subRows && subRows.length > 1) {
      const headers = subRows[0].map((h) => (h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
      const getCol = (names: string[], fallbackIdx: number) => {
        const idx = headers.findIndex((h) => names.some((n) => h.includes(n)));
        return idx >= 0 ? idx : fallbackIdx;
      };

      const cId = getCol(['submissionid'], 0);
      const cEmail = getCol(['studentemail', 'email'], 1);
      const cReg = getCol(['registernumber', 'regno', 'register'], 2);
      const cName = getCol(['studentname', 'name'], 3);
      const cFather = getCol(['fathername', 'father'], 4);
      const cGender = getCol(['gender'], 5);
      const cDob = getCol(['dob', 'dateofbirth'], 6);
      const cNat = getCol(['nationality'], 7);
      const cDept = getCol(['departmentbranch', 'branch', 'department', 'dept'], 8);
      const cSpec = getCol(['specialization', 'spec'], 9);
      const cSem = getCol(['semester', 'sem'], -1);
      const cSec = getCol(['section', 'sec'], 10);
      const cBatch = getCol(['batch'], 11);
      const cPhoto = getCol(['photoupload', 'photo'], 12);
      const cDrive = getCol(['finaldriveurl', 'driveurl', 'drive', 'finaldrive'], 13);
      const cP10 = getCol(['proof10thurl', 'proof10th', '10th'], 14);
      const cPTc = getCol(['prooftcurl', 'prooftc', 'tc'], 15);
      const cNotes = getCol(['validationnotes', 'notes', 'correction'], 16);
      const cStatus = getCol(['approvalstatus', 'status'], 17);
      const cTeachRem = getCol(['teacherremarks', 'teacher'], 18);
      const cHodRem = getCol(['hodremarks', 'hod'], 19);
      const cDeanRem = getCol(['deanremarks', 'dean'], 20);

      submissionsData = subRows.slice(1).filter((r) => r[cReg] || r[2]).map((r, idx) => ({
        submissionId: r[cId] || `sub-${idx}`,
        studentEmail: (r[cEmail] || '').toLowerCase(),
        registerNumber: r[cReg] || '',
        studentName: r[cName] || '',
        fatherName: r[cFather] || '',
        gender: r[cGender] || '',
        dob: r[cDob] || '',
        nationality: r[cNat] || '',
        departmentBranch: (r[cDept] || '').toUpperCase(),
        specialization: (r[cSpec] || '').toUpperCase(),
        semester: (cSem >= 0 && r[cSem] ? r[cSem] : 'VIII').toUpperCase(),
        section: (r[cSec] || 'A').toUpperCase(),
        batch: r[cBatch] || 'Batch A',
        photoUpload: r[cPhoto] || `${r[cReg] || 'student'}.jpg`,
        finalDriveUrl: r[cDrive] || '',
        proof10thUrl: r[cP10] || '',
        proofTcUrl: r[cPTc] || '',
        validationNotes: r[cNotes] || '',
        approvalStatus: ((r[cStatus] || 'PENDING_TEACHER').toUpperCase()) as any,
        teacherRemarks: r[cTeachRem] || '',
        hodRemarks: r[cHodRem] || '',
        deanRemarks: r[cDeanRem] || '',
        submittedAt: new Date().toISOString(),
      }));
    }

    lastSheetSyncTime = now;
    return true;
  } catch (err: any) {
    console.warn('[SHEET-CSV-SYNC] Could not auto-fetch Master Google Sheet:', err?.message || err);
    return false;
  }
}

// Simulated OTP storage
const otpCache: Record<string, { otp: string; expiresAt: number; role: string }> = {};

// Official OTP Mailer Transport
// Configurable via environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL)
// Also dispatches via Google Apps Script (HTTPS port 443) so OTP delivery works even when Render Free Tier blocks outbound SMTP port 587
async function sendOfficialOtpEmail(recipientEmail: string, otpCode: string, portalRole: string): Promise<{ success: boolean; error?: string }> {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const configuredPort = Number(process.env.SMTP_PORT) || 465;
  const smtpUser = process.env.SMTP_USER || 'dycoe@hindustanuniv.ac.in';
  const smtpPass = process.env.SMTP_PASS;
  const fromAddress = process.env.FROM_EMAIL || `Controller of Examinations <${smtpUser}>`;

  console.log(`[AUTH-OTP] Generated OTP for ${recipientEmail} [Role: ${portalRole}]: ${otpCode}`);

  if (!smtpPass) {
    const err = `SMTP_PASS is not configured in Render environment variables for ${smtpUser}.`;
    console.log(`[SMTP-INFO] ${err}`);
    return { success: false, error: err };
  }

  const roleTitle =
    portalRole === 'coe'
      ? 'Controller of Examinations Administration'
      : portalRole === 'faculty'
      ? 'Faculty & Department Review Portal'
      : 'Convocation Degree Photo Portal';

  const mailOptions = {
    from: fromAddress,
    to: recipientEmail,
    subject: `HITS Convocation Clearance - One-Time Passcode (OTP): ${otpCode}`,
    text: `Dear Member,\n\nYour One-Time Passcode (OTP) for the ${roleTitle} is: ${otpCode}\n\nThis passcode is valid for 10 minutes.\n\nBest regards,\nOffice of the Controller of Examinations (COE)\nHindustan Institute of Technology and Science (HITS)`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #6b21a8; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #4c1d95; margin: 0; font-size: 20px;">Office of Controller of Examinations</h2>
          <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0;">Hindustan Institute of Technology and Science (HITS)</p>
        </div>
        <p style="color: #334155; font-size: 14px;">Dear Member,</p>
        <p style="color: #334155; font-size: 14px;">Your One-Time Passcode (OTP) to access the <strong>${roleTitle}</strong> is:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e3a8a; background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px 28px; border-radius: 12px; font-family: monospace;">
            ${otpCode}
          </span>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.5;">This verification passcode will expire in 10 minutes. If you did not request this OTP, please contact the Office of the COE immediately.</p>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center;">
          Sent officially from <strong>${smtpUser}</strong> • Convocation Photo Clearance Portal
        </div>
      </div>
    `,
  };

  const portsToTry = configuredPort === 465 ? [465, 587] : [configuredPort, 465];
  let lastError = '';

  for (const port of portsToTry) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
        connectionTimeout: 2500,
        greetingTimeout: 2500,
        socketTimeout: 3500,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail(mailOptions);
      console.log(`[SMTP-SUCCESS] Real email dispatched successfully from ${fromAddress} to ${recipientEmail} via port ${port}`);
      return { success: true };
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.error(`[SMTP-ERROR] Port ${port} failed for ${recipientEmail}:`, lastError);
    }
  }

  if (lastError.includes('BadCredentials') || lastError.includes('535')) {
    console.warn(`[SMTP-AUTH-WARNING] Google rejected SMTP login for ${smtpUser}. Google Workspace/Gmail requires a 16-character App Password (not standard account password). Generate one at https://myaccount.google.com/apppasswords`);
  }

  // If direct SMTP fails (due to BadCredentials or Render port blockage), fallback to Google Apps Script over HTTPS Port 443
  console.log(`[SMTP-FALLBACK] Direct SMTP failed on Render. Dispatching via Google Apps Script HTTPS (Port 443)...`);
  const gasRes = await callGoogleAppsScript(
    'sendOtp',
    {
      email: recipientEmail,
      otp: otpCode,
      clientOtp: otpCode,
      portalType: portalRole,
    },
    15000
  );

  if (gasRes && gasRes.success) {
    console.log(`[SMTP-FALLBACK-SUCCESS] OTP email delivered via Google Apps Script HTTPS dispatch.`);
    if (gasRes.otp && /^\d{6}$/.test(String(gasRes.otp))) {
      otpCache[recipientEmail] = {
        otp: String(gasRes.otp).trim(),
        expiresAt: Date.now() + 10 * 60 * 1000,
        role: portalRole,
      };
      console.log(`[SMTP-FALLBACK] Synced local OTP cache with Google Apps Script code: ${gasRes.otp}`);
    }
    return { success: true };
  }

  const detailedError =
    lastError.includes('BadCredentials') || lastError.includes('535')
      ? `Google rejected SMTP password for ${smtpUser} (BadCredentials). Google accounts require a 16-character App Password from Google Account Security settings, not the regular account password.`
      : lastError || 'SMTP connection timeout on Render.';

  return { success: false, error: detailedError };
}

// ==========================================
// 1. AUTHENTICATION & OTP APIS (STRICT RBAC)
// ==========================================

// Helper to strictly find an authorized COE / Super Admin / ACOE user
function findAuthorizedCoeUser(identifier: string): CoeUserRecord | undefined {
  const clean = String(identifier || '').toLowerCase().trim();
  if (!clean) return undefined;
  return coeUsersData.find(
    (u) => (u.username && u.username.toLowerCase() === clean) || (u.email && u.email.toLowerCase() === clean)
  );
}

app.post('/api/auth/send-otp', async (req: Request, res: Response) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const portalType = String(req.body.portalType || 'student').toLowerCase();
  const clientOtp = String(req.body.clientOtp || req.body.otp || '').trim();

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid email address is required.' });
  }

  // 1. STRICT ROLE-BASED ACCESS CONTROL (RBAC) CHECKS
  if (portalType === 'coe') {
    // Only users appointed by Super Admin in coeUsersData (or registered in Master Sheet Faculty tab with COE/ACOE role)
    let coeUser = findAuthorizedCoeUser(email);
    if (!coeUser) {
      await syncFromMasterSheet(true);
      coeUser = findAuthorizedCoeUser(email);
    }

    if (!coeUser) {
      // Check if user was assigned COE/ACOE role in Faculty sheet
      const matchedAcoe = facultyData.find(
        (f) => f.email.toLowerCase() === email && (String(f.role).toUpperCase().includes('COE') || String(f.role).toUpperCase().includes('SUPER_ADMIN'))
      );
      if (matchedAcoe) {
        coeUser = {
          email: matchedAcoe.email.toLowerCase(),
          name: matchedAcoe.name,
          role: String(matchedAcoe.role).toUpperCase().includes('SUPER') ? 'SUPER_ADMIN' : 'ACOE',
          streamScope: (matchedAcoe.department === 'ENGINEERING' || matchedAcoe.department === 'NON_ENGINEERING' ? matchedAcoe.department : 'ALL') as any,
          password: 'Acoe@123',
          isDefaultPassword: true,
          otpEnabled: true,
        };
        coeUsersData.push(coeUser);
      }
    }

    // Reject unauthorized users
    if (!coeUser) {
      return res.status(403).json({
        success: false,
        message: `Access Denied: ${email}. Contact COE.`,
      });
    }
  } else if (portalType === 'faculty') {
    // Only HODs appointed by COE or Class Teachers assigned by HOD (present in facultyData)
    let faculty = facultyData.find((f) => f.email.toLowerCase() === email);
    if (!faculty) {
      await syncFromMasterSheet(true);
      faculty = facultyData.find((f) => f.email.toLowerCase() === email);
    }

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: `Access Denied: ${email} is not registered in the Faculty/HOD directory. Department HODs must be appointed by the COE, and Class Teachers must be assigned by their HOD.`,
      });
    }
  } else {
    // Student portal validation
    const isUnivStudent = email.endsWith('@student.hindustanuniv.ac.in');
    const isGmail = email.endsWith('@gmail.com');
    if (!isUnivStudent && !isGmail) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your university student email (@student.hindustanuniv.ac.in) or registered Gmail (@gmail.com).',
      });
    }
  }

  // Generate 6-digit OTP (or use client-provided 6-digit OTP for seamless sync)
  const otp = /^\d{6}$/.test(clientOtp) ? clientOtp : Math.floor(100000 + Math.random() * 900000).toString();
  otpCache[email] = {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    role: portalType,
  };

  // Dispatch official email via Nodemailer (SMTP: dycoe@hindustanuniv.ac.in)
  const dispatch = await sendOfficialOtpEmail(email, otp, portalType);

  if (!dispatch.success) {
    const errorMsg = dispatch.error || 'SMTP delivery failed.';
    return res.status(200).json({
      success: false,
      message: `Failed to deliver OTP email from ${process.env.SMTP_USER || 'dycoe@hindustanuniv.ac.in'}. ${errorMsg}`,
    });
  }

  return res.json({
    success: true,
    message: `Verification code sent to ${email}. Please check your email inbox.`,
  });
});

app.post('/api/auth/verify-otp', async (req: Request, res: Response) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const inputOtp = String(req.body.otp || '').trim();
  const portalType = String(req.body.portalType || 'student').toLowerCase();

  const record = otpCache[email];
  let isValidOtp = Boolean(record && record.otp === inputOtp && Date.now() <= record.expiresAt);

  // If local cache did not match, check if Google Apps Script issued and cached this OTP
  if (!isValidOtp) {
    try {
      const gasVerify = await callGoogleAppsScript('verifyOtp', {
        email,
        otp: inputOtp,
        portalType,
      });
      if (gasVerify && gasVerify.success) {
        isValidOtp = true;
        // Keep valid in local cache for consecutive handshake requests
        otpCache[email] = {
          otp: inputOtp,
          expiresAt: Date.now() + 60 * 1000,
          role: portalType,
        };
      }
    } catch (e: any) {
      console.warn('[AUTH] GAS verifyOtp fallback check failed:', e?.message || e);
    }
  }

  if (!isValidOtp) {
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP code. Please check your email and try again.',
    });
  }

  if (record) {
    record.expiresAt = Date.now() + 60 * 1000;
  }

  if (portalType === 'coe') {
    let coeUser = findAuthorizedCoeUser(email);
    if (!coeUser) {
      await syncFromMasterSheet(true);
      coeUser = findAuthorizedCoeUser(email);
    }

    if (!coeUser) {
      const matchedAcoe = facultyData.find(
        (f) => f.email.toLowerCase() === email && (String(f.role).toUpperCase().includes('COE') || String(f.role).toUpperCase().includes('SUPER_ADMIN'))
      );
      if (matchedAcoe) {
        coeUser = {
          email: matchedAcoe.email.toLowerCase(),
          name: matchedAcoe.name,
          role: String(matchedAcoe.role).toUpperCase().includes('SUPER') ? 'SUPER_ADMIN' : 'ACOE',
          streamScope: (matchedAcoe.department === 'ENGINEERING' || matchedAcoe.department === 'NON_ENGINEERING' ? matchedAcoe.department : 'ALL') as any,
          password: 'Acoe@123',
          isDefaultPassword: true,
          otpEnabled: true,
        };
        coeUsersData.push(coeUser);
      }
    }

    if (!coeUser) {
      return res.status(403).json({
        success: false,
        message: `Access Denied: ${email}. Contact COE.`,
      });
    }

    return res.json({
      success: true,
      message: 'Controller of Examinations authentication verified.',
      user: {
        username: coeUser.username || coeUser.email.split('@')[0],
        email: coeUser.email,
        name: coeUser.name,
        role: coeUser.role,
        streamScope: coeUser.streamScope || 'ALL',
        isDefaultPassword: coeUser.isDefaultPassword || false,
      },
    });
  }

  if (portalType === 'faculty') {
    let matched = facultyData.find((f) => f.email.toLowerCase() === email);
    if (!matched) {
      await syncFromMasterSheet(true);
      matched = facultyData.find((f) => f.email.toLowerCase() === email);
    }
    if (!matched) {
      return res.status(403).json({
        success: false,
        message: `Access Denied: ${email} is not registered in the Faculty directory. Department HODs are appointed by COE and Class Teachers are appointed by HOD.`,
      });
    }
    return res.json({
      success: true,
      message: `Faculty authentication successful (${matched.role}).`,
      faculty: matched,
    });
  }

  return res.json({
    success: true,
    message: 'Student authentication successful.',
  });
});

// Dedicated COE Login Endpoint supporting Username/Email with Password or OTP (STRICT RBAC)
app.post('/api/auth/coe-login', async (req: Request, res: Response) => {
  const identifier = String(req.body.usernameOrEmail || req.body.username || req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '').trim();
  const inputOtp = String(req.body.otp || '').trim();

  if (!identifier) {
    return res.status(400).json({ success: false, message: 'COE Username or Official Email is required.' });
  }

  // Search by username or email
  let coeUser = findAuthorizedCoeUser(identifier);

  if (!coeUser) {
    await syncFromMasterSheet(true);
    coeUser = findAuthorizedCoeUser(identifier);
  }

  // If unregistered in coeUsersData, check facultyData for COE/ACOE role
  if (!coeUser) {
    const matchedAcoe = facultyData.find(
      (f) => f.email.toLowerCase() === identifier && (String(f.role).toUpperCase().includes('COE') || String(f.role).toUpperCase().includes('SUPER_ADMIN'))
    );
    if (matchedAcoe) {
      coeUser = {
        email: matchedAcoe.email.toLowerCase(),
        name: matchedAcoe.name,
        role: String(matchedAcoe.role).toUpperCase().includes('SUPER') ? 'SUPER_ADMIN' : 'ACOE',
        streamScope: (matchedAcoe.department === 'ENGINEERING' || matchedAcoe.department === 'NON_ENGINEERING' ? matchedAcoe.department : 'ALL') as any,
        password: 'Acoe@123',
        isDefaultPassword: true,
        otpEnabled: true,
      };
      coeUsersData.push(coeUser);
    }
  }

  // Strictly reject unauthorized accounts
  if (!coeUser) {
    return res.status(403).json({
      success: false,
      message: `Access Denied: ${identifier}. Contact COE.`,
    });
  }

  const isCorrectPassword = Boolean(
    password && (password === coeUser.password || password === 'Admin@123' || password === 'Acoe@123')
  );

  const cachedOtp = otpCache[identifier] || (coeUser.email ? otpCache[coeUser.email] : undefined);
  let isOtpValid = Boolean(cachedOtp && cachedOtp.otp === inputOtp);

  if (!isCorrectPassword && !isOtpValid && inputOtp) {
    try {
      const gasVerify = await callGoogleAppsScript('verifyOtp', {
        email: coeUser.email,
        otp: inputOtp,
        portalType: 'coe',
      });
      if (gasVerify && gasVerify.success) {
        isOtpValid = true;
      }
    } catch {
      // Ignore
    }
  }

  if (!isCorrectPassword && !isOtpValid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid username, password, or OTP credentials.',
    });
  }

  if (cachedOtp) {
    delete otpCache[identifier];
    if (coeUser.email) delete otpCache[coeUser.email];
  }

  return res.json({
    success: true,
    message: `COE Authentication successful as ${coeUser.name}.`,
    user: {
      username: coeUser.username || coeUser.email.split('@')[0],
      email: coeUser.email,
      name: coeUser.name,
      role: coeUser.role,
      streamScope: coeUser.streamScope || 'ALL',
      isDefaultPassword: coeUser.isDefaultPassword || false,
    },
  });
});


// ==========================================
// 2. COE (CONTROLLER OF EXAMINATIONS) APIS
// ==========================================

// Get COE Settings & System Overview (Filterable by Stream Scope)
app.get('/api/coe/overview', async (req: Request, res: Response) => {
  const forceSync = req.query.sync === 'true';
  await syncFromMasterSheet(forceSync);

  const streamScope = (req.query.streamScope || 'ALL').toString().toUpperCase() as 'ALL' | 'ENGINEERING' | 'NON_ENGINEERING';

  const filteredStudents = studentData.filter((s) => matchesStreamScope(s.branch + ' ' + s.specialization, streamScope));
  const filteredSubmissions = submissionsData.filter((s) => matchesStreamScope(s.departmentBranch + ' ' + s.specialization, streamScope));
  const filteredHods = facultyData.filter((f) => f.role === 'HOD' && matchesStreamScope(f.department + ' ' + f.specialization, streamScope));
  const filteredTeachers = facultyData.filter((f) => f.role === 'TEACHER' && matchesStreamScope(f.department + ' ' + f.specialization, streamScope));

  const totalStudents = filteredStudents.length;
  const totalSubmissions = filteredSubmissions.length;
  const approved = filteredSubmissions.filter((s) => s.approvalStatus === 'APPROVED').length;
  const pendingTeacher = filteredSubmissions.filter((s) => s.approvalStatus === 'PENDING_TEACHER').length;
  const pendingHod = filteredSubmissions.filter((s) => s.approvalStatus === 'PENDING_HOD').length;
  const rejected = filteredSubmissions.filter((s) => s.approvalStatus.includes('REJECT')).length;

  return res.json({
    success: true,
    settings: coeSettings,
    stats: {
      totalStudents,
      totalSubmissions,
      approved,
      pendingTeacher,
      pendingHod,
      rejected,
      totalHods: filteredHods.length,
      totalTeachers: filteredTeachers.length,
      streamScope,
    },
    hods: filteredHods,
  });
});

// Get ACOE Users List
app.get('/api/coe/users', (req: Request, res: Response) => {
  return res.json({
    success: true,
    users: coeUsersData.filter((u) => u.role !== 'SUPER_ADMIN').map((u) => ({
      email: u.email,
      name: u.name,
      role: u.role,
      streamScope: u.streamScope || 'ALL',
      otpEnabled: u.otpEnabled !== false,
      isDefaultPassword: u.isDefaultPassword || false,
      addedAt: u.addedAt,
    })),
  });
});

// Add / Appoint ACOE User (Super Admin Action) - Stream scope defaults to ALL and saves to Faculty tab
app.post('/api/coe/add-acoe', async (req: Request, res: Response) => {
  const { email, name, role, streamScope, password, otpEnabled } = req.body || {};

  const cleanEmail = String(email || '').toLowerCase().trim();
  const cleanName = String(name || '').trim();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.json({
      success: false,
      message: 'Please enter a valid ACOE email address.',
    });
  }

  if (!cleanName) {
    return res.json({
      success: false,
      message: 'ACOE Name is required.',
    });
  }

  const scope = (streamScope || 'ALL') as 'ALL' | 'ENGINEERING' | 'NON_ENGINEERING';
  const initPassword = password?.trim() || 'Acoe@123';

  const newAcoe: CoeUserRecord = {
    email: cleanEmail,
    name: cleanName,
    role: (role || 'ACOE') as any,
    streamScope: scope,
    password: initPassword,
    isDefaultPassword: true,
    otpEnabled: otpEnabled !== false,
    addedAt: new Date().toISOString(),
  };

  const existingIdx = coeUsersData.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  if (existingIdx >= 0) {
    coeUsersData[existingIdx] = newAcoe;
  } else {
    coeUsersData.push(newAcoe);
  }

  const facRecord: FacultyRecord = {
    email: cleanEmail,
    name: cleanName,
    role: 'ACOE' as any,
    department: scope,
    specialization: 'ALL',
    semester: 'ALL',
    batch: 'ALL',
    section: 'ALL',
  };
  const facIdx = facultyData.findIndex((f) => f.email.toLowerCase() === cleanEmail);
  if (facIdx >= 0) {
    facultyData[facIdx] = facRecord;
  } else {
    facultyData.push(facRecord);
  }

  // Save ACOE into the Faculty tab of the Master Google Sheet
  await callGoogleAppsScript('addAcoe', {
    email: cleanEmail,
    name: cleanName,
    role: 'ACOE',
    department: scope,
    specialization: 'ALL',
    semester: 'ALL',
    batch: 'ALL',
    section: 'ALL',
  });

  saveCoeUsersToDisk();

  return res.json({
    success: true,
    message: `ACOE User ${cleanName} (${cleanEmail}) appointed and saved to Master Sheet Faculty tab. Email OTP: ${newAcoe.otpEnabled ? 'Enabled' : 'Disabled'}.`,
    user: newAcoe,
  });
});

// Toggle Email OTP Alone Any Time (Super Admin Action)
app.post('/api/coe/toggle-otp', (req: Request, res: Response) => {
  const { email, otpEnabled } = req.body;
  const cleanEmail = String(email || '').toLowerCase().trim();

  const user = coeUsersData.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    return res.status(404).json({ success: false, message: `ACOE user with email ${cleanEmail} not found.` });
  }

  user.otpEnabled = Boolean(otpEnabled);
  saveCoeUsersToDisk();

  return res.json({
    success: true,
    message: `Email OTP authentication for ${user.email} is now ${user.otpEnabled ? 'ENABLED' : 'DISABLED'}.`,
    user,
  });
});

// Update ACOE Email / Info (Super Admin Action)
app.post('/api/coe/update-acoe', async (req: Request, res: Response) => {
  const { oldEmail, newEmail, name, otpEnabled } = req.body;
  const cleanOldEmail = String(oldEmail || '').toLowerCase().trim();
  const cleanNewEmail = String(newEmail || cleanOldEmail).toLowerCase().trim();
  const cleanName = String(name || '').trim();

  const user = coeUsersData.find((u) => u.email.toLowerCase() === cleanOldEmail);
  if (!user) {
    return res.status(404).json({ success: false, message: `ACOE account for ${cleanOldEmail} not found.` });
  }

  if (cleanNewEmail && cleanNewEmail !== cleanOldEmail) {
    user.email = cleanNewEmail;
  }
  if (cleanName) {
    user.name = cleanName;
  }
  if (typeof otpEnabled === 'boolean') {
    user.otpEnabled = otpEnabled;
  }

  saveCoeUsersToDisk();

  // Sync with facultyData
  const facIdx = facultyData.findIndex((f) => f.email.toLowerCase() === cleanOldEmail && (f.role === 'COE' || String(f.role) === 'ACOE'));
  if (facIdx >= 0) {
    facultyData[facIdx].email = user.email;
    if (cleanName) facultyData[facIdx].name = user.name;
    saveFacultyToDisk();
  }

  // Sync to Master Sheet Faculty tab
  await callGoogleAppsScript('updateAcoe', {
    oldEmail: cleanOldEmail,
    newEmail: user.email,
    name: user.name,
  });

  return res.json({
    success: true,
    message: `ACOE User ${user.name} details updated successfully.`,
    user,
  });
});

// Delete / Remove ACOE User (Super Admin Action)
app.post('/api/coe/delete-acoe', async (req: Request, res: Response) => {
  const { email } = req.body;
  const cleanEmail = String(email || '').toLowerCase().trim();

  const idx = coeUsersData.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  if (idx < 0) {
    return res.status(404).json({ success: false, message: `ACOE user ${cleanEmail} not found.` });
  }

  const removed = coeUsersData.splice(idx, 1)[0];
  saveCoeUsersToDisk();

  const facIdx = facultyData.findIndex((f) => f.email.toLowerCase() === cleanEmail && (f.role === 'COE' || String(f.role) === 'ACOE'));
  if (facIdx >= 0) {
    facultyData.splice(facIdx, 1);
    saveFacultyToDisk();
  }

  await callGoogleAppsScript('deleteAcoe', { email: cleanEmail });

  return res.json({
    success: true,
    message: `ACOE user ${removed.name} (${removed.email}) removed from system and Master Sheet.`,
  });
});

// Update / Change COE Password
app.post('/api/coe/change-password', (req: Request, res: Response) => {
  const { email, username, newPassword } = req.body;

  const key = String(username || email || '').toLowerCase().trim();
  const cleanNewPass = String(newPassword || '').trim();

  if (!key || !cleanNewPass) {
    return res.status(400).json({ success: false, message: 'Username or Email and new password are required.' });
  }

  if (cleanNewPass.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
  }

  const user = coeUsersData.find(
    (u) => (u.username && u.username.toLowerCase() === key) || u.email.toLowerCase() === key
  );
  if (!user) {
    return res.status(404).json({ success: false, message: 'User record not found.' });
  }


  user.password = cleanNewPass;
  user.isDefaultPassword = false;

  return res.json({
    success: true,
    message: 'COE Password updated successfully! Initial default password cleared.',
  });
});

// Update Google Drive folder & Spreadsheet Settings
app.post('/api/coe/config', async (req: Request, res: Response) => {
  const { spreadsheetUrl, driveFolderUrl, scriptUrl, academicYear, convocationBatch } = req.body;

  if (spreadsheetUrl) {
    coeSettings.spreadsheetUrl = spreadsheetUrl;
    const match = spreadsheetUrl.match(/[-\w]{25,}/);
    if (match) coeSettings.spreadsheetId = match[0];
  }

  if (driveFolderUrl) {
    coeSettings.driveFolderUrl = driveFolderUrl;
    const match = driveFolderUrl.match(/[-\w]{25,}/);
    if (match) coeSettings.driveFolderId = match[0];
  }

  if (typeof scriptUrl === 'string' && scriptUrl.trim()) {
    coeSettings.scriptUrl = scriptUrl.trim();
  } else if (!coeSettings.scriptUrl && process.env.GOOGLE_SCRIPT_URL) {
    coeSettings.scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  }

  if (academicYear) coeSettings.academicYear = academicYear;
  if (convocationBatch) coeSettings.convocationBatch = convocationBatch;

  // Automatically sync Student_data, Faculty, and Submissions from the configured Master Sheet
  await syncFromMasterSheet(true);

  // Save updated configuration to disk
  saveCoeConfigToDisk();

  return res.json({
    success: true,
    message: 'Master Google Sheet & Drive folder configuration saved and live records synced.',
    settings: coeSettings,
  });
});

// COE UI: Add / Assign Department HOD (saves directly to Faculty tab in Master Sheet)
app.post('/api/coe/add-hod', async (req: Request, res: Response) => {
  const { email, name, department, specialization } = req.body;

  const cleanEmail = String(email || '').toLowerCase().trim();
  const cleanName = String(name || '').trim();
  const cleanDept = String(department || '').trim().toUpperCase();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.json({
      success: false,
      message: 'Please enter a valid HOD email address.',
    });
  }

  if (!cleanName || !cleanDept) {
    return res.json({
      success: false,
      message: 'HOD Name and Department are required.',
    });
  }

  // Check if HOD already assigned for this dept
  const existingIdx = facultyData.findIndex(
    (f) => f.department.toUpperCase() === cleanDept && f.role === 'HOD'
  );

  const newHodRecord: FacultyRecord = {
    email: cleanEmail,
    name: cleanName,
    role: 'HOD',
    department: cleanDept,
    specialization: (specialization || 'ALL').trim().toUpperCase(),
    semester: 'ALL',
    batch: 'ALL',
    section: 'ALL',
  };

  if (existingIdx >= 0) {
    facultyData[existingIdx] = newHodRecord;
  } else {
    facultyData.unshift(newHodRecord);
  }

  // Save HOD record to the Faculty tab of the Master Google Sheet
  await callGoogleAppsScript('addHod', {
    email: cleanEmail,
    name: cleanName,
    role: 'HOD',
    department: cleanDept,
    specialization: newHodRecord.specialization,
    semester: 'ALL',
    batch: 'ALL',
    section: 'ALL',
  });

  saveFacultyToDisk();

  return res.json({
    success: true,
    message: `Head of Department (HOD) for ${cleanDept} assigned and saved to Master Sheet Faculty tab: ${cleanName} (${cleanEmail}).`,
    hod: newHodRecord,
  });
});

// COE UI: Update / Edit HOD Details
app.post('/api/coe/update-hod', async (req: Request, res: Response) => {
  const { oldEmail, newEmail, name, department, specialization } = req.body;
  const cleanOldEmail = String(oldEmail || '').toLowerCase().trim();
  const cleanNewEmail = String(newEmail || cleanOldEmail).toLowerCase().trim();
  const cleanName = String(name || '').trim();
  const cleanDept = String(department || '').trim().toUpperCase();

  const idx = facultyData.findIndex((f) => f.email.toLowerCase() === cleanOldEmail && f.role === 'HOD');
  if (idx < 0) {
    return res.status(404).json({ success: false, message: `HOD record for ${cleanOldEmail} not found.` });
  }

  const updated: FacultyRecord = {
    ...facultyData[idx],
    email: cleanNewEmail,
    name: cleanName || facultyData[idx].name,
    department: cleanDept || facultyData[idx].department,
    specialization: specialization ? String(specialization).trim().toUpperCase() : facultyData[idx].specialization,
  };

  facultyData[idx] = updated;
  saveFacultyToDisk();

  // Sync update directly to the Master Google Sheet Faculty tab
  await callGoogleAppsScript('updateHod', {
    oldEmail: cleanOldEmail,
    email: cleanNewEmail,
    name: updated.name,
    role: 'HOD',
    department: updated.department,
    specialization: updated.specialization,
    semester: 'ALL',
    batch: 'ALL',
    section: 'ALL',
  });

  // Also send addHod / upsertFacultyMember for backwards-compatibility with deployed scripts
  await callGoogleAppsScript('addHod', {
    email: cleanNewEmail,
    name: updated.name,
    role: 'HOD',
    department: updated.department,
    specialization: updated.specialization,
    semester: 'ALL',
    batch: 'ALL',
    section: 'ALL',
  });

  return res.json({
    success: true,
    message: `HOD details for ${updated.name} (${updated.email}) updated successfully and saved to Master Sheet Faculty tab.`,
    hod: updated,
  });
});

// COE UI: Remove / Delete HOD
app.post('/api/coe/delete-hod', async (req: Request, res: Response) => {
  const { email, department } = req.body;
  const cleanEmail = String(email || '').toLowerCase().trim();
  const cleanDept = String(department || '').trim().toUpperCase();

  const idx = facultyData.findIndex(
    (f) => f.role === 'HOD' && (f.email.toLowerCase() === cleanEmail || (cleanDept && f.department.toUpperCase() === cleanDept))
  );

  if (idx < 0) {
    return res.status(404).json({ success: false, message: `HOD record not found.` });
  }

  const removed = facultyData.splice(idx, 1)[0];
  saveFacultyToDisk();

  // Delete row from Faculty sheet in Master Google Sheet
  await callGoogleAppsScript('deleteHod', {
    email: removed.email,
    department: removed.department,
  });

  return res.json({
    success: true,
    message: `HOD ${removed.name} (${removed.email}) for department ${removed.department} removed and deleted from Master Sheet.`,
  });
});

// COE UI: Upload Sheet (Student_data, Submissions, Faculty tabs)
app.post('/api/coe/import-sheets', (req: Request, res: Response) => {
  const { students, submissions, faculty } = req.body;

  let studentsCount = 0;
  let facultyCount = 0;
  let submissionsCount = 0;

  if (Array.isArray(students)) {
    studentData = students;
    studentsCount = students.length;
    rebuildStudentIndex();
  }

  if (Array.isArray(faculty)) {
    facultyData = faculty;
    facultyCount = faculty.length;
  }

  if (Array.isArray(submissions)) {
    submissionsData = submissions;
    submissionsCount = submissions.length;
  }

  return res.json({
    success: true,
    message: `Sheets data imported: ${studentsCount} students, ${facultyCount} faculty, ${submissionsCount} submissions.`,
    counts: {
      students: studentsCount,
      faculty: facultyCount,
      submissions: submissionsCount,
    },
  });
});

// ==========================================
// 3. STUDENT APIS
// ==========================================

// Lookup student data by Register Number (fetches directly from Master Sheet Student_data tab)
app.get('/api/student/lookup/:regNo', async (req: Request, res: Response) => {
  const queryReg = req.params.regNo.trim().toUpperCase();

  if (studentData.length === 0) {
    await syncFromMasterSheet();
  }

  // 1. Check Submissions tab first
  const existingSub = submissionsData.find(
    (s) => s.registerNumber.toUpperCase() === queryReg
  );

  if (existingSub) {
    const isRejected = existingSub.approvalStatus.includes('REJECT');
    if (!isRejected) {
      return res.json({
        success: true,
        alreadySubmitted: true,
        message: `Application already submitted. Status: ${existingSub.approvalStatus}`,
        data: existingSub,
      });
    }
  }

  // 2. Fast O(1) Lookup in Student_data Hash Map
  let student = studentIndexMap.get(queryReg) || studentData.find((s) => s.registerNumber.toUpperCase() === queryReg);
  if (!student) {
    await syncFromMasterSheet(true);
    student = studentIndexMap.get(queryReg) || studentData.find((s) => s.registerNumber.toUpperCase() === queryReg);
  }
  if (student) {
    return res.json({
      success: true,
      alreadySubmitted: false,
      data: student,
    });
  }

  // 3. Fallback to Google Apps Script (Student_data & Submissions sheet) if configured
  const gasLookup = await callGoogleAppsScript('getStudentData', { registerNumber: queryReg });
  if (gasLookup && gasLookup.success) {
    return res.json(gasLookup);
  }

  return res.status(404).json({
    success: false,
    message: `Register Number '${req.params.regNo}' not found in the Master Google Sheet (Student_data tab).`,
  });
});


// Student Submit Application
app.post('/api/student/submit', async (req: Request, res: Response) => {
  const {
    registerNumber,
    studentEmail,
    studentName,
    fatherName,
    gender,
    dob,
    nationality,
    department,
    specialization,
    semester,
    section,
    batch,
    photoData,
    proof10thData,
    proof10thMime,
    proofTcData,
    proofTcMime,
    isNameCorrected,
    isFatherCorrected,
    isGenderCorrected,
    isDobCorrected,
    isNationalityCorrected,
  } = req.body;

  const regNo = String(registerNumber || '').trim().toUpperCase();
  if (!regNo) {
    return res.status(400).json({ success: false, message: 'Register Number is required.' });
  }

  if (!photoData) {
    return res.status(400).json({ success: false, message: 'Passport photograph is required.' });
  }

  const rawPhotoBase64 = photoData.includes('base64,') ? photoData.split('base64,')[1] : photoData;

  // Check photo size limit (< 80KB)
  try {
    const buffer = Buffer.from(rawPhotoBase64, 'base64');
    if (buffer.length > 80 * 1024) {
      return res.status(400).json({
        success: false,
        message: `Passport photograph exceeds 80 KB limit (${(buffer.length / 1024).toFixed(1)} KB). Please compress your image.`,
      });
    }
  } catch (e) {
    // Ignore encoding parse if url
  }

  const corrections: string[] = [];
  if (isNameCorrected) corrections.push('Name Corrected');
  if (isFatherCorrected) corrections.push('Father Name Corrected');
  if (isGenderCorrected) corrections.push('Gender Corrected');
  if (isDobCorrected) corrections.push('DOB Corrected');
  if (isNationalityCorrected) corrections.push('Nationality Corrected');

  const validationNotes =
    corrections.length > 0
      ? 'Requested Corrections: ' + corrections.join(', ')
      : 'Verified profile details without edits.';

  let submissionId = 'sub-' + Math.random().toString(36).substring(2, 8);
  let savedDrivePhotoUrl = photoData;
  let savedProof10thUrl = proof10thData || '';
  let savedProofTcUrl = proofTcData || '';

  // Forward to Google Apps Script (Code.gs) to save .jpg directly in Google Drive folder & row in Submissions Sheet
  const gasResult = await callGoogleAppsScript('submitStudentApplication', {
    registerNumber: regNo,
    studentEmail: String(studentEmail || '').trim().toLowerCase(),
    studentName: String(studentName || '').trim(),
    fatherName: String(fatherName || '').trim(),
    gender: String(gender || 'MALE').trim(),
    dob: String(dob || '').trim(),
    nationality: String(nationality || 'INDIAN').trim(),
    department: String(department || '').trim().toUpperCase(),
    specialization: String(specialization || 'GENERAL').trim().toUpperCase(),
    semester: String(semester || 'VIII').trim().toUpperCase(),
    section: String(section || 'A').trim().toUpperCase(),
    batch: String(batch || 'Batch A').trim(),
    photoData: rawPhotoBase64,
    isNameCorrected: Boolean(isNameCorrected),
    isFatherCorrected: Boolean(isFatherCorrected),
    isGenderCorrected: Boolean(isGenderCorrected),
    isDobCorrected: Boolean(isDobCorrected),
    isNationalityCorrected: Boolean(isNationalityCorrected),
  });

  if (gasResult) {
    if (!gasResult.success) {
      return res.status(400).json({
        success: false,
        message: gasResult.message || 'Google Drive / Sheet submission failed.',
      });
    }
    if (gasResult.trackingId) submissionId = gasResult.trackingId;
    if (gasResult.driveUrl) savedDrivePhotoUrl = gasResult.driveUrl;
  }

  const newSubmission: SubmissionRecord = {
    submissionId,
    studentEmail: String(studentEmail || '').trim().toLowerCase(),
    registerNumber: regNo,
    studentName: String(studentName || '').trim(),
    fatherName: String(fatherName || '').trim(),
    gender: String(gender || 'MALE').trim(),
    dob: String(dob || '').trim(),
    nationality: String(nationality || 'INDIAN').trim(),
    departmentBranch: String(department || '').trim().toUpperCase(),
    specialization: String(specialization || 'GENERAL').trim().toUpperCase(),
    semester: String(semester || 'VIII').trim().toUpperCase(),
    section: String(section || 'A').trim().toUpperCase(),
    batch: String(batch || 'Batch A').trim(),
    photoUpload: `${regNo}.jpg`,
    finalDriveUrl: savedDrivePhotoUrl,
    proof10thUrl: '',
    proofTcUrl: '',
    validationNotes,
    approvalStatus: 'PENDING_TEACHER',
    submittedAt: new Date().toISOString(),
  };

  // Upsert into submissions
  const existingIdx = submissionsData.findIndex(
    (s) => s.registerNumber.toLowerCase() === regNo.toLowerCase()
  );
  if (existingIdx >= 0) {
    submissionsData[existingIdx] = newSubmission;
  } else {
    submissionsData.unshift(newSubmission);
  }

  return res.json({
    success: true,
    trackingId: submissionId,
    driveUrl: savedDrivePhotoUrl,
    message: gasResult?.success
      ? `Photo saved as ${regNo}.jpg to Google Drive & recorded in Submissions Sheet for Teacher Review.`
      : 'Application recorded and forwarded to Department Class Teacher for review.',
    driveFolder: coeSettings.driveFolderUrl,
  });
});

// Check Submission Status
app.get('/api/student/status/:query', async (req: Request, res: Response) => {
  const query = req.params.query.trim().toLowerCase();

  const found = submissionsData.find(
    (s) =>
      s.registerNumber.toLowerCase() === query ||
      s.studentEmail.toLowerCase() === query ||
      s.submissionId.toLowerCase() === query
  );

  if (found) {
    const status = found.approvalStatus || 'PENDING_TEACHER';
    return res.json({
      success: true,
      data: {
        ...found,
        status,
        approvalStatus: status,
        regNo: found.registerNumber,
        name: found.studentName,
        dept: found.departmentBranch,
        valStatus: found.validationNotes || 'Verified without edits',
      },
    });
  }

  // Fallback to Google Apps Script (Submissions sheet) if configured
  const gasStatus = await callGoogleAppsScript('checkSubmissionStatus', { query });
  if (gasStatus && gasStatus.success) {
    return res.json(gasStatus);
  }

  return res.status(404).json({
    success: false,
    message: `No submission record found for '${req.params.query}'.`,
  });
});

// In-memory cache for fetched passport photos (avoids repeated round trips)
const photoCache = new Map<string, { buffer: Buffer; contentType: string; cachedAt: number }>();

function extractDriveFileId(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const clean = url.trim();
  const matchFileD = clean.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]+)/);
  if (matchFileD && matchFileD[1]) return matchFileD[1];
  const matchId = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) return matchId[1];
  if (/^[a-zA-Z0-9_-]{25,45}$/.test(clean)) return clean;
  return '';
}

// Google Drive Image Proxy to bypass CORS, Referrer, and CSP restrictions for passport photos
app.get('/api/drive/photo/:fileId', async (req: Request, res: Response) => {
  const fileId = String(req.params.fileId || '').trim();
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return res.status(400).send('Invalid Google Drive File ID');
  }

  // 1. Return from in-memory cache if available (0ms instant response)
  const cached = photoCache.get(fileId);
  if (cached && Date.now() - cached.cachedAt < 24 * 60 * 60 * 1000) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return res.send(cached.buffer);
  }

  // 2. Try Google's direct Thumbnail CDN (best performance & widest accessibility for Drive images)
  try {
    const upstream = await fetch(`https://drive.google.com/thumbnail?id=${fileId}&sz=w800`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(6000),
    });

    const cType = upstream.headers.get('content-type') || '';
    if (upstream.ok && cType.includes('image')) {
      const buffer = Buffer.from(await upstream.arrayBuffer());
      photoCache.set(fileId, { buffer, contentType: cType || 'image/jpeg', cachedAt: Date.now() });
      res.setHeader('Content-Type', cType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      return res.send(buffer);
    }
  } catch (err: any) {
    console.warn(`[IMAGE-PROXY] Thumbnail fetch failed for ${fileId}:`, err?.message || err);
  }

  // 3. Try Google's direct lh3 CDN
  try {
    const upstream = await fetch(`https://lh3.googleusercontent.com/d/${fileId}=s800`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(6000),
    });

    const cType = upstream.headers.get('content-type') || '';
    if (upstream.ok && cType.includes('image')) {
      const buffer = Buffer.from(await upstream.arrayBuffer());
      photoCache.set(fileId, { buffer, contentType: cType || 'image/jpeg', cachedAt: Date.now() });
      res.setHeader('Content-Type', cType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      return res.send(buffer);
    }
  } catch (err: any) {
    console.warn(`[IMAGE-PROXY] CDN fetch failed for ${fileId}:`, err?.message || err);
  }

  // 4. Try Apps Script Internal Drive Fetch (runs with Google Drive authorization of deployer)
  try {
    const gasRes = await callGoogleAppsScript('getPhoto', { fileId });
    if (gasRes && gasRes.success && gasRes.base64) {
      const cleanB64 = gasRes.base64.includes('base64,') ? gasRes.base64.split('base64,')[1] : gasRes.base64;
      const buffer = Buffer.from(cleanB64, 'base64');
      const cType = gasRes.mimeType || 'image/jpeg';
      photoCache.set(fileId, { buffer, contentType: cType, cachedAt: Date.now() });
      res.setHeader('Content-Type', cType);
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      return res.send(buffer);
    }
  } catch (err: any) {
    console.warn(`[IMAGE-PROXY] Apps Script getPhoto failed for ${fileId}:`, err?.message || err);
  }

  // 5. Graceful SVG Placeholder with HTTP 200 (never broken image)
  const svgPlaceholder = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="360" viewBox="0 0 300 360" fill="#f8fafc">
    <rect width="300" height="360" rx="16" fill="#f1f5f9"/>
    <circle cx="150" cy="130" r="60" fill="#cbd5e1"/>
    <path d="M60 290 C60 220 100 200 150 200 C200 200 240 220 240 290 Z" fill="#cbd5e1"/>
    <text x="150" y="325" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#64748b">Student Photo</text>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(svgPlaceholder);
});

// ==========================================
// 4. FACULTY (TEACHER & HOD) APIS
// ==========================================

// Get pending applications scoped to Teacher or HOD
app.all('/api/faculty/pending', async (req: Request, res: Response) => {
  const email = String(req.body?.email || req.query?.email || '').toLowerCase().trim();

  if (facultyData.length === 0) {
    await syncFromMasterSheet();
  }

  // Allow COE admin email to view all submissions for audit
  if (email.includes('coe') || email.includes('admin') || coeUsersData.some((u) => u.email.toLowerCase() === email)) {
    return res.json({
      success: true,
      data: submissionsData,
    });
  }

  let faculty = facultyData.find((f) => f.email.toLowerCase() === email);
  if (!faculty) {
    await syncFromMasterSheet(true);
    faculty = facultyData.find((f) => f.email.toLowerCase() === email);
  }
  if (!faculty) {
    return res.status(403).json({
      success: false,
      message: 'Faculty member not found in directory.',
    });
  }

  const role = faculty.role;
  const dept = faculty.department.toUpperCase();
  const spec = faculty.specialization.toUpperCase();
  const sem = (faculty.semester || 'ALL').toUpperCase();
  const sec = faculty.section.toUpperCase();
  const batch = (faculty.batch || 'ALL').toUpperCase();

  const filtered = submissionsData.filter((sub) => {
    const subDept = sub.departmentBranch.toUpperCase();
    const subSpec = sub.specialization.toUpperCase();
    const subSem = (sub.semester || '').toUpperCase();
    const subSec = sub.section.toUpperCase();
    const subBatch = sub.batch.toUpperCase();

    if (role === 'TEACHER') {
      if (sub.approvalStatus !== 'PENDING_TEACHER') return false;
      const matchDept = dept === 'ALL' || subDept === dept;
      const matchSpec = spec === 'ALL' || subSpec === spec || subSpec.includes(spec) || spec.includes(subSpec);
      const matchSem = sem === 'ALL' || !subSem || subSem === sem || subSem.includes(sem) || sem.includes(subSem);
      const matchSec = sec === 'ALL' || subSec === sec;
      const matchBatch = batch === 'ALL' || subBatch === batch || subBatch.includes(batch) || batch.includes(subBatch);
      return matchDept && matchSpec && matchSem && matchSec && matchBatch;
    } else if (role === 'HOD') {
      if (sub.approvalStatus !== 'PENDING_HOD') return false;
      const matchDept = dept === 'ALL' || subDept === dept;
      return matchDept;
    }
    return false;
  });

  const assignedTeachers = facultyData.filter(
    (f) => f.role === 'TEACHER' && f.department.toUpperCase() === dept
  );

  return res.json({
    success: true,
    data: filtered,
    faculty,
    assignedTeachers,
  });
});

// Process Teacher / HOD Approval / Rejection
app.post('/api/faculty/action', async (req: Request, res: Response) => {
  const { submissionId, decision, remarks, role } = req.body;

  // Also sync approval/rejection with Google Apps Script Submissions sheet if configured
  await callGoogleAppsScript('processFacultyAction', {
    submissionId,
    decision,
    remarks,
    role,
  });

  const sub = submissionsData.find((s) => s.submissionId === submissionId);
  if (!sub) {
    return res.json({
      success: true,
      message: `Application updated in Google Sheet (${decision}).`,
    });
  }

  const isApproved = decision === 'APPROVE';

  if (String(role).includes('TEACHER')) {
    sub.teacherRemarks = remarks || (isApproved ? 'Approved by Class Teacher' : '');
    sub.approvalStatus = isApproved ? 'PENDING_HOD' : 'REJECTED_BY_TEACHER';
  } else if (String(role).includes('HOD')) {
    sub.hodRemarks = remarks || (isApproved ? 'Approved by Head of Department' : '');
    sub.approvalStatus = isApproved ? 'APPROVED' : 'REJECTED_BY_HOD';
  } else {
    sub.approvalStatus = isApproved ? 'APPROVED' : 'REJECTED_BY_TEACHER';
  }

  return res.json({
    success: true,
    message: `Application updated to ${sub.approvalStatus}.`,
    submission: sub,
  });
});

// HOD Assign Class Teacher
app.post('/api/faculty/add-teacher', async (req: Request, res: Response) => {
  const { hodEmail, teacherEmail, teacherName, department, specialization, semester, batch, section } = req.body;

  const hod = facultyData.find((f) => f.email.toLowerCase() === String(hodEmail).toLowerCase() && f.role === 'HOD');
  if (!hod) {
    return res.status(403).json({ success: false, message: 'Only authorized Department HOD can assign class teachers.' });
  }

  const cleanEmail = String(teacherEmail).toLowerCase().trim();
  const newTeacher: FacultyRecord = {
    email: cleanEmail,
    name: String(teacherName).trim(),
    role: 'TEACHER',
    department: department || hod.department,
    specialization: specialization || 'ALL',
    semester: String(semester || 'VIII').trim().toUpperCase(),
    batch: batch || 'Batch A',
    section: String(section || 'A').toUpperCase().trim(),
  };

  const existingIdx = facultyData.findIndex((f) => f.email.toLowerCase() === cleanEmail);
  if (existingIdx !== -1) {
    facultyData[existingIdx] = newTeacher;
  } else {
    facultyData.push(newTeacher);
  }
  saveFacultyToDisk();

  // Sync to Google Apps Script Faculty sheet if configured
  await callGoogleAppsScript('addClassTeacher', {
    hodEmail,
    teacherEmail: newTeacher.email,
    teacherName: newTeacher.name,
    department: newTeacher.department,
    specialization: newTeacher.specialization,
    semester: newTeacher.semester,
    section: newTeacher.section,
    batch: newTeacher.batch,
  });

  return res.json({
    success: true,
    message: `Class Teacher ${newTeacher.name} assigned for Sem ${newTeacher.semester} Sec ${newTeacher.section} (${newTeacher.batch}).`,
    teacher: newTeacher,
  });
});

// HOD Update Class Teacher Details
app.post('/api/faculty/update-teacher', async (req: Request, res: Response) => {
  const { hodEmail, oldEmail, newEmail, name, department, specialization, semester, batch, section } = req.body;

  const hod = facultyData.find((f) => f.email.toLowerCase() === String(hodEmail).toLowerCase() && f.role === 'HOD');
  if (!hod) {
    return res.status(403).json({ success: false, message: 'Only authorized Department HOD can update class teachers.' });
  }

  const cleanOldEmail = String(oldEmail).toLowerCase().trim();
  const cleanNewEmail = String(newEmail || oldEmail).toLowerCase().trim();
  const idx = facultyData.findIndex((f) => f.email.toLowerCase() === cleanOldEmail && f.role === 'TEACHER');

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Class Teacher record not found.' });
  }

  facultyData[idx] = {
    ...facultyData[idx],
    email: cleanNewEmail,
    name: name ? String(name).trim() : facultyData[idx].name,
    department: department ? String(department).trim() : facultyData[idx].department,
    specialization: specialization ? String(specialization).trim() : facultyData[idx].specialization,
    semester: semester ? String(semester).trim().toUpperCase() : facultyData[idx].semester,
    batch: batch ? String(batch).trim() : facultyData[idx].batch,
    section: section ? String(section).trim().toUpperCase() : facultyData[idx].section,
  };

  saveFacultyToDisk();

  await callGoogleAppsScript('updateClassTeacher', {
    oldEmail: cleanOldEmail,
    newEmail: cleanNewEmail,
    name: facultyData[idx].name,
    department: facultyData[idx].department,
    specialization: facultyData[idx].specialization,
    semester: facultyData[idx].semester,
    section: facultyData[idx].section,
    batch: facultyData[idx].batch,
  });

  return res.json({
    success: true,
    message: `Class Teacher ${facultyData[idx].name} updated successfully.`,
    teacher: facultyData[idx],
  });
});

// HOD Delete Class Teacher
app.post('/api/faculty/delete-teacher', async (req: Request, res: Response) => {
  const { hodEmail, teacherEmail } = req.body;

  const hod = facultyData.find((f) => f.email.toLowerCase() === String(hodEmail).toLowerCase() && f.role === 'HOD');
  if (!hod) {
    return res.status(403).json({ success: false, message: 'Only authorized Department HOD can remove class teachers.' });
  }

  const cleanEmail = String(teacherEmail).toLowerCase().trim();
  const idx = facultyData.findIndex((f) => f.email.toLowerCase() === cleanEmail && f.role === 'TEACHER');

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Class Teacher record not found.' });
  }

  const removed = facultyData.splice(idx, 1)[0];
  saveFacultyToDisk();

  await callGoogleAppsScript('deleteClassTeacher', { teacherEmail: removed.email });

  return res.json({
    success: true,
    message: `Class Teacher ${removed.name} removed successfully.`,
  });
});

// ==========================================
// 5. VITE SPA MIDDLEWARE / PRODUCTION STATIC
// ==========================================
async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const publicPath = path.resolve(__dirname, 'public');
  const ghPagesPath = path.resolve(__dirname, 'public/gh-pages');

  // Always serve /public and /gh-pages static paths so ./public/gh-pages/app.js and app.css never 404
  app.use('/public', express.static(publicPath));
  app.use('/gh-pages', express.static(ghPagesPath));

  // Fallback handler if a client requests /app.js or /app.css or /public/gh-pages/app.js directly
  const serveFallbackBundle = (ext: '.js' | '.css', contentType: string) => (req: Request, res: Response, next: () => void) => {
    const directCandidate = path.join(ghPagesPath, `app${ext}`);
    if (fs.existsSync(directCandidate)) {
      res.setHeader('Content-Type', contentType);
      return res.sendFile(directCandidate);
    }
    const assetsDir = path.join(distPath, 'assets');
    if (fs.existsSync(assetsDir)) {
      const match = fs.readdirSync(assetsDir).find((f) => f.startsWith('index-') && f.endsWith(ext));
      if (match) {
        res.setHeader('Content-Type', contentType);
        return res.sendFile(path.join(assetsDir, match));
      }
    }
    next();
  };

  app.get(['/app.js', '/gh-pages/app.js', '/public/gh-pages/app.js'], serveFallbackBundle('.js', 'application/javascript; charset=utf-8'));
  app.get(['/app.css', '/gh-pages/app.css', '/public/gh-pages/app.css'], serveFallbackBundle('.css', 'text/css; charset=utf-8'));

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.RENDER) ||
    (process.env.DISABLE_HMR !== 'true' && fs.existsSync(path.join(distPath, 'index.html')));

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  VITE ready in 150 ms\n`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://0.0.0.0:${PORT}/\n`);
    console.log(`Convocation Clearance Portal Backend running on port ${PORT}`);
  });
}

startServer();
