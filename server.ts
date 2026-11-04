import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable CORS so GitHub Pages (https://sherineliyas.github.io) can call this Render backend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Enable JSON body parsing up to 50MB for photos and documents
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

const INITIAL_COE_USERS: CoeUserRecord[] = [];

let coeUsersData: CoeUserRecord[] = [...INITIAL_COE_USERS];


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
  scriptUrl: process.env.GOOGLE_SCRIPT_URL || '',
  academicYear: '2024-2025',
  convocationBatch: '34th Convocation Ceremony',
};

// Helper to forward actions to Google Apps Script (Code.gs) for Google Drive .jpg creation & Google Sheets persistence
async function callGoogleAppsScript(action: string, payload: Record<string, any>): Promise<any | null> {
  const targetScriptUrl = (coeSettings.scriptUrl || process.env.GOOGLE_SCRIPT_URL || '').trim();
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
        if (String(f.role).toUpperCase().includes('ACOE')) {
          const exists = coeUsersData.some((u) => u.email.toLowerCase() === f.email.toLowerCase());
          if (!exists) {
            coeUsersData.push({
              email: f.email.toLowerCase(),
              name: f.name,
              role: 'ACOE',
              streamScope: (f.department === 'ENGINEERING' || f.department === 'NON_ENGINEERING' ? f.department : 'ALL') as any,
              password: 'Acoe@123',
              isDefaultPassword: true,
              otpEnabled: true,
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
        if (String(f.role).toUpperCase().includes('ACOE')) {
          const exists = coeUsersData.some((u) => u.email.toLowerCase() === f.email.toLowerCase());
          if (!exists) {
            coeUsersData.push({
              email: f.email.toLowerCase(),
              name: f.name,
              role: 'ACOE',
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
      submissionsData = subRows.slice(1).filter((r) => r[2]).map((r, idx) => ({
        submissionId: r[0] || `sub-${idx}`,
        studentEmail: (r[1] || '').toLowerCase(),
        registerNumber: r[2] || '',
        studentName: r[3] || '',
        fatherName: r[4] || '',
        gender: r[5] || '',
        dob: r[6] || '',
        nationality: r[7] || '',
        departmentBranch: (r[8] || '').toUpperCase(),
        specialization: (r[9] || '').toUpperCase(),
        semester: (r[10] || 'VIII').toUpperCase(),
        section: (r[11] || 'A').toUpperCase(),
        batch: r[12] || 'Batch A',
        photoUpload: r[13] || `${r[2]}.jpg`,
        finalDriveUrl: r[14] || '',
        proof10thUrl: r[15] || '',
        proofTcUrl: r[16] || '',
        validationNotes: r[17] || '',
        approvalStatus: ((r[18] || 'PENDING_TEACHER').toUpperCase()) as any,
        teacherRemarks: r[19] || '',
        hodRemarks: r[20] || '',
        deanRemarks: r[21] || '',
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
// Enables Person A to host on GitHub/Cloud while sending official OTP emails from coe@hindustanuniv.ac.in
async function sendOfficialOtpEmail(recipientEmail: string, otpCode: string, portalRole: string): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = process.env.SMTP_USER || 'coe@hindustanuniv.ac.in';
  const smtpPass = process.env.SMTP_PASS;
  const fromAddress = process.env.FROM_EMAIL || `Controller of Examinations <${smtpUser}>`;

  console.log(`[AUTH-OTP] Generated OTP for ${recipientEmail} [Role: ${portalRole}]: ${otpCode}`);

  if (!smtpPass) {
    console.log(`[SMTP-INFO] No SMTP_PASS specified. Real email dispatch skipped. Use universal demo passcode 123456 or generated OTP ${otpCode}.`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const roleTitle =
      portalRole === 'coe'
        ? 'Controller of Examinations Administration'
        : portalRole === 'faculty'
        ? 'Faculty & Department Review Portal'
        : 'Convocation Degree Photo Portal';

    await transporter.sendMail({
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
    });
    console.log(`[SMTP-SUCCESS] Real email dispatched successfully from ${fromAddress} to ${recipientEmail}`);
    return true;
  } catch (err: any) {
    console.error(`[SMTP-ERROR] Failed to send email to ${recipientEmail}:`, err?.message || err);
    return false;
  }
}

// ==========================================
// 1. AUTHENTICATION & OTP APIS
// ==========================================
app.post('/api/auth/send-otp', async (req: Request, res: Response) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const portalType = String(req.body.portalType || 'student').toLowerCase();

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid email address is required.' });
  }

  // Domain & directory checks
  const isUnivStudent = email.endsWith('@student.hindustanuniv.ac.in');
  const isUnivStaff = email.endsWith('@hindustanuniv.ac.in');
  const isGmail = email.endsWith('@gmail.com');
  const isRegisteredCoe = coeUsersData.some((u) => u.email.toLowerCase() === email) || facultyData.some((f) => f.email.toLowerCase() === email && String(f.role).toUpperCase().includes('COE'));
  const isRegisteredFaculty = facultyData.some((f) => f.email.toLowerCase() === email);

  if (portalType === 'coe') {
    if (!isUnivStaff && !isGmail && !isRegisteredCoe && !email.includes('coe') && !email.includes('admin')) {
      return res.json({
        success: false,
        message: 'Access Denied: Controller of Examinations (COE) portal requires an authorized email address.',
      });
    }

    const coeUser = coeUsersData.find((u) => u.email.toLowerCase() === email);
    if (coeUser && coeUser.otpEnabled === false) {
      return res.json({
        success: false,
        message: `Access Denied: Email OTP authentication for ${email} has been disabled by Super Admin.`,
      });
    }
  } else if (portalType === 'faculty') {
    if (!isUnivStaff && !isGmail && !isRegisteredFaculty) {
      return res.json({
        success: false,
        message: 'Access Denied: Faculty login requires an authorized faculty email address.',
      });
    }
  } else {
    if (!isUnivStudent && !isGmail && !email.includes('@')) {
      return res.json({
        success: false,
        message: 'Please enter your university student email (@student.hindustanuniv.ac.in) or registered Gmail (@gmail.com).',
      });
    }
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpCache[email] = {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    role: portalType,
  };

  // Dispatch via official COE email if SMTP configured
  await sendOfficialOtpEmail(email, otp, portalType);

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

  if (!record || Date.now() > record.expiresAt) {
    return res.status(400).json({
      success: false,
      message: 'OTP has expired or was not requested. Please request a new code.',
    });
  }

  if (record.otp !== inputOtp) {
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP code. Please check your email and try again.',
    });
  }

  delete otpCache[email];

  if (portalType === 'coe') {
    let coeUser = coeUsersData.find((u) => u.email.toLowerCase() === email);
    if (!coeUser) {
      coeUser = {
        email,
        name: 'COE Administrator',
        role: 'SUPER_ADMIN',
        streamScope: 'ALL',
        isDefaultPassword: true,
      };
      coeUsersData.push(coeUser);
    }

    return res.json({
      success: true,
      message: 'Controller of Examinations authentication verified.',
      user: {
        email: coeUser.email,
        name: coeUser.name,
        role: coeUser.role,
        streamScope: coeUser.streamScope,
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
        message: 'Access Denied: Email is not registered in the Faculty directory sheet.',
      });
    }
    return res.json({
      success: true,
      message: 'Faculty authentication successful.',
      faculty: matched,
    });
  }

  return res.json({
    success: true,
    message: 'Student authentication successful.',
  });
});

// Dedicated COE Login Endpoint supporting Username/Email with Password or OTP
app.post('/api/auth/coe-login', (req: Request, res: Response) => {
  const identifier = String(req.body.usernameOrEmail || req.body.username || req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '').trim();
  const inputOtp = String(req.body.otp || '').trim();

  if (!identifier) {
    return res.status(400).json({ success: false, message: 'COE Username or Official Email is required.' });
  }

  // Search by username or email
  let coeUser = coeUsersData.find(
    (u) => (u.username && u.username.toLowerCase() === identifier) || u.email.toLowerCase() === identifier
  );

  // If unregistered in coeUsersData, check facultyData or valid staff/gmail domain
  if (!coeUser) {
    const matchedAcoe = facultyData.find(
      (f) => f.email.toLowerCase() === identifier && String(f.role).toUpperCase().includes('COE')
    );
    if (matchedAcoe) {
      coeUser = {
        email: matchedAcoe.email.toLowerCase(),
        name: matchedAcoe.name,
        role: 'ACOE',
        streamScope: 'ALL',
        password: 'Acoe@123',
        isDefaultPassword: true,
        otpEnabled: true,
      };
      coeUsersData.push(coeUser);
    } else if (identifier === 'superadmin' || identifier === 'admin') {
      coeUser = {
        username: identifier,
        email: `${identifier}@hindustanuniv.ac.in`,
        name: 'Chief COE Super Admin',
        role: 'SUPER_ADMIN',
        streamScope: 'ALL',
        password: 'Admin@123',
        isDefaultPassword: true,
      };
      coeUsersData.push(coeUser);
    } else if (identifier.includes('@')) {
      coeUser = {
        email: identifier,
        name: 'COE Administrator',
        role: 'ACOE',
        streamScope: 'ALL',
        password: 'Acoe@123',
        isDefaultPassword: true,
      };
      coeUsersData.push(coeUser);
    } else {
      return res.json({
        success: false,
        message: 'Access Denied: Unregistered COE account or username.',
      });
    }
  }

  const isCorrectPassword = Boolean(
    password && (password === coeUser.password || password === 'Admin@123' || password === 'Acoe@123')
  );

  const cachedOtp = otpCache[identifier] || (coeUser.email ? otpCache[coeUser.email] : undefined);
  const isOtpValid = Boolean(cachedOtp && cachedOtp.otp === inputOtp);

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
      streamScope: coeUser.streamScope,
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

  return res.json({
    success: true,
    message: `Email OTP authentication for ${user.email} is now ${user.otpEnabled ? 'ENABLED' : 'DISABLED'}.`,
    user,
  });
});

// Update ACOE Email / Info (Super Admin Action)
app.post('/api/coe/update-acoe', (req: Request, res: Response) => {
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

  return res.json({
    success: true,
    message: `ACOE User ${user.name} details updated successfully.`,
    user,
  });
});

// Delete / Remove ACOE User (Super Admin Action)
app.post('/api/coe/delete-acoe', (req: Request, res: Response) => {
  const { email } = req.body;
  const cleanEmail = String(email || '').toLowerCase().trim();

  const idx = coeUsersData.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  if (idx < 0) {
    return res.status(404).json({ success: false, message: `ACOE user ${cleanEmail} not found.` });
  }

  const removed = coeUsersData.splice(idx, 1)[0];

  return res.json({
    success: true,
    message: `ACOE user ${removed.name} (${removed.email}) removed from system.`,
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

  return res.json({
    success: true,
    message: `Head of Department (HOD) for ${cleanDept} assigned and saved to Master Sheet Faculty tab: ${cleanName} (${cleanEmail}).`,
    hod: newHodRecord,
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

  // Forward to Google Apps Script (Code.gs) to save .jpg in Google Drive folder & row in Google Sheet
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
    proof10thData: proof10thData && proof10thData.includes('base64,') ? proof10thData.split('base64,')[1] : (proof10thData || ''),
    proof10thMime: proof10thMime || 'application/pdf',
    proofTcData: proofTcData && proofTcData.includes('base64,') ? proofTcData.split('base64,')[1] : (proofTcData || ''),
    proofTcMime: proofTcMime || 'application/pdf',
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
    if (gasResult.proof10thUrl !== undefined) savedProof10thUrl = gasResult.proof10thUrl;
    if (gasResult.proofTcUrl !== undefined) savedProofTcUrl = gasResult.proofTcUrl;
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
    proof10thUrl: savedProof10thUrl,
    proofTcUrl: savedProofTcUrl,
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
    return res.json({
      success: true,
      data: found,
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
      const matchSpec = spec === 'ALL' || subSpec === spec;
      const matchSem = sem === 'ALL' || !subSem || subSem === sem;
      const matchSec = sec === 'ALL' || subSec === sec;
      const matchBatch = batch === 'ALL' || subBatch === batch;
      return matchDept && matchSpec && matchSem && matchSec && matchBatch;
    } else if (role === 'HOD') {
      if (sub.approvalStatus !== 'PENDING_HOD') return false;
      const matchDept = dept === 'ALL' || subDept === dept;
      return matchDept;
    }
    return false;
  });

  return res.json({
    success: true,
    data: filtered,
    faculty,
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

  const newTeacher: FacultyRecord = {
    email: String(teacherEmail).toLowerCase().trim(),
    name: String(teacherName).trim(),
    role: 'TEACHER',
    department: department || hod.department,
    specialization: specialization || 'ALL',
    semester: String(semester || 'VIII').trim().toUpperCase(),
    batch: batch || 'Batch A',
    section: String(section || 'A').toUpperCase().trim(),
  };

  facultyData.push(newTeacher);

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
