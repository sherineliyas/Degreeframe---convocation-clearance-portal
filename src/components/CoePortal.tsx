import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  FolderOpen,
  FileSpreadsheet,
  UserPlus,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  ExternalLink,
  Search,
  Download,
  Building,
  Mail,
  User,
  KeyRound,
  Sparkles,
  LogOut,
  RefreshCw,
  Eye,
  X,
  FileText,
  RotateCcw,
  BookOpen
} from 'lucide-react';
import { api } from '../services/api';
import { UserManualModal } from './UserManualModal';
import { FacultyRecord, SubmissionRecord, CoeSettings, CoeOverviewStats } from '../types';
import { downloadMasterExcelTemplate } from '../utils/excelTemplate';

interface CoeUserInfo {
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ACOE';
  streamScope: 'ENGINEERING' | 'NON_ENGINEERING' | 'ALL';
  isDefaultPassword?: boolean;
}

export const CoePortal: React.FC = () => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('coe_session_auth') === 'true';
  });
  const [currentCoeUser, setCurrentCoeUser] = useState<CoeUserInfo | null>(() => {
    const saved = sessionStorage.getItem('coe_user_data');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    const email = sessionStorage.getItem('coe_session_email');
    if (email) {
      const isSuper = email === 'superadmin@hindustanuniv.ac.in' || email.includes('superadmin');
      const isEngg = email.includes('1') || email.includes('engg');
      return {
        email,
        name: isSuper ? 'Chief COE Super Admin' : isEngg ? 'ACOE (Engineering)' : 'ACOE (Non-Engineering)',
        role: isSuper ? 'SUPER_ADMIN' : 'ACOE',
        streamScope: isSuper ? 'ALL' : isEngg ? 'ENGINEERING' : 'NON_ENGINEERING',
        isDefaultPassword: true,
      };
    }
    return null;
  });

  const [adminEmail, setAdminEmail] = useState<string>(() => {
    return sessionStorage.getItem('coe_session_email') || '';
  });
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authMode, setAuthMode] = useState<'PASSWORD' | 'OTP'>('OTP');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpInput, setOtpInput] = useState<string>('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [authSuccess, setAuthSuccess] = useState<string>('');

  // Password Change Modal State
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [newPasswordVal, setNewPasswordVal] = useState<string>('');
  const [confirmPasswordVal, setConfirmPasswordVal] = useState<string>('');
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [passwordChangeStatus, setPasswordChangeStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ACOE Management State (Super Admin tab)
  const [acoeUsersList, setAcoeUsersList] = useState<CoeUserInfo[]>([]);
  const [isLoadingAcoeUsers, setIsLoadingAcoeUsers] = useState<boolean>(false);
  const [acoeForm, setAcoeForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'ACOE',
    streamScope: 'ENGINEERING' as 'ENGINEERING' | 'NON_ENGINEERING',
  });
  const [isAddingAcoe, setIsAddingAcoe] = useState<boolean>(false);

  // COE Dashboard State
  const [activeTab, setActiveTab] = useState<'overview' | 'drive' | 'sheets' | 'hods' | 'acoe' | 'submissions'>('overview');
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isManualOpen, setIsManualOpen] = useState<boolean>(false);

  // Settings & Data
  const [settings, setSettings] = useState<CoeSettings>({
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1a-wxvfyMzC6zmcyoWBFzzrFjysyituOVfvoXtxvVNPQ/edit',
    spreadsheetId: '1a-wxvfyMzC6zmcyoWBFzzrFjysyituOVfvoXtxvVNPQ',
    driveFolderUrl: 'https://drive.google.com/drive/folders/1w3hVMlTQNVUh7Bpru_cwlEJ6TQ77kfqI',
    driveFolderId: '1w3hVMlTQNVUh7Bpru_cwlEJ6TQ77kfqI',
    academicYear: '2024-2025',
    convocationBatch: '34th Convocation Ceremony',
  });

  const [stats, setStats] = useState<CoeOverviewStats>({
    totalStudents: 0,
    totalSubmissions: 0,
    approved: 0,
    pendingTeacher: 0,
    pendingHod: 0,
    rejected: 0,
    totalHods: 0,
    totalTeachers: 0,
  });

  const [hods, setHods] = useState<FacultyRecord[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);

  // Form: Drive Config
  const [driveUrlInput, setDriveUrlInput] = useState('');
  const [sheetUrlInput, setSheetUrlInput] = useState('');
  const [scriptUrlInput, setScriptUrlInput] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Form: Add HOD
  const [hodForm, setHodForm] = useState({
    name: '',
    email: '',
    department: 'AERONAUTICAL ENGINEERING',
    specialization: 'ALL',
  });
  const [isAddingHod, setIsAddingHod] = useState(false);

  // Sheet Import State
  const [sheetTabSelect, setSheetTabSelect] = useState<'Student_data' | 'Submissions' | 'Faculty'>('Student_data');
  const [csvContent, setCsvContent] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Submissions filter & inspect modal
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectRecord, setInspectRecord] = useState<SubmissionRecord | null>(null);

  // Load COE Data
  const loadCoeData = async () => {
    setIsLoadingData(true);
    try {
      const scope = currentCoeUser?.streamScope;
      const res = await api.getCoeOverview(scope);
      if (res.success) {
        if (res.settings) {
          setSettings(res.settings);
          setDriveUrlInput(res.settings.driveFolderUrl);
          setSheetUrlInput(res.settings.spreadsheetUrl);
          setScriptUrlInput(res.settings.scriptUrl || '');
          setBatchInput(res.settings.convocationBatch);
          setYearInput(res.settings.academicYear);
        }
        if (res.stats) {
          setStats(res.stats);
        }
        if (res.hods) {
          setHods(res.hods);
        }
      }

      // Also get all submissions for oversight
      const subRes = await api.getPendingApplications(currentCoeUser?.email || 'coe@hindustanuniv.ac.in');
      if (subRes.success && subRes.data) {
        setSubmissions(subRes.data);
      }
    } catch (e: any) {
      console.warn('Could not load overview from server:', e);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Load ACOE Users List
  const loadAcoeUsers = async () => {
    setIsLoadingAcoeUsers(true);
    try {
      const res = await api.getCoeUsers();
      if (res.success && res.users) {
        setAcoeUsersList(res.users);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingAcoeUsers(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadCoeData();
      loadAcoeUsers();
    }
  }, [isAuthenticated, currentCoeUser?.streamScope]);

  // Auth: Password Login Handler
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    let targetEmail = adminEmail.toLowerCase().trim();
    if (!targetEmail) {
      setAuthError('Please enter authorized COE administrative email.');
      return;
    }
    if (!targetEmail.includes('@') && targetEmail !== 'superadmin') {
      targetEmail = targetEmail + '@hindustanuniv.ac.in';
      setAdminEmail(targetEmail);
    }
    if (!targetEmail.endsWith('@hindustanuniv.ac.in') && targetEmail !== 'superadmin') {
      setAuthError('Official COE email must end in @hindustanuniv.ac.in');
      return;
    }

    setIsSubmittingAuth(true);
    try {
      const res = await api.coeLogin(targetEmail, passwordInput);
      if (res.success && res.coeUser) {
        setIsAuthenticated(true);
        setCurrentCoeUser(res.coeUser);
        sessionStorage.setItem('coe_session_auth', 'true');
        sessionStorage.setItem('coe_session_email', res.coeUser.email);
        sessionStorage.setItem('coe_user_data', JSON.stringify(res.coeUser));
        setAuthSuccess('Authenticated successfully.');
      } else {
        setAuthError(res.message || 'Invalid email or password.');
      }
    } catch {
      setAuthError('Login connection error.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Auth: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    let targetEmail = adminEmail.toLowerCase().trim();
    if (!targetEmail) {
      setAuthError('Please enter authorized COE administrative email.');
      return;
    }
    if (!targetEmail.includes('@') && targetEmail !== 'superadmin') {
      targetEmail = targetEmail + '@hindustanuniv.ac.in';
      setAdminEmail(targetEmail);
    }
    if (!targetEmail.endsWith('@hindustanuniv.ac.in') && targetEmail !== 'superadmin') {
      setAuthError('Official COE email must end in @hindustanuniv.ac.in');
      return;
    }

    setIsSubmittingAuth(true);
    try {
      const res = await api.sendOtp(targetEmail, 'coe');
      if (res.success) {
        setOtpSent(true);
        setAuthSuccess(res.message || 'Verification passcode sent.');
      } else {
        setAuthError(res.message || 'Unable to authenticate COE account.');
      }
    } catch {
      setAuthError('Connection error. Please try again.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Auth: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!otpInput.trim()) {
      setAuthError('Please enter the 6-digit OTP code.');
      return;
    }

    setIsSubmittingAuth(true);
    try {
      const res = await api.verifyOtp(adminEmail, otpInput, 'coe');
      if (res.success) {
        const loginRes = await api.coeLogin(adminEmail, undefined, otpInput);
        setIsAuthenticated(true);
        if (loginRes.success && loginRes.coeUser) {
          setCurrentCoeUser(loginRes.coeUser);
          sessionStorage.setItem('coe_user_data', JSON.stringify(loginRes.coeUser));
        }
        sessionStorage.setItem('coe_session_auth', 'true');
        sessionStorage.setItem('coe_session_email', adminEmail);
      } else {
        setAuthError(res.message || 'Invalid or expired OTP code.');
      }
    } catch {
      setAuthError('Verification failed. Please retry.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('coe_session_auth');
    sessionStorage.removeItem('coe_session_email');
    sessionStorage.removeItem('coe_user_data');
    setIsAuthenticated(false);
    setCurrentCoeUser(null);
    setOtpSent(false);
    setOtpInput('');
    setPasswordInput('');
  };

  // Handle Add ACOE Administrator
  const handleAddAcoeUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acoeForm.email.trim() || !acoeForm.name.trim()) {
      setNotification({ type: 'error', message: 'ACOE email and full name are required.' });
      return;
    }

    setIsAddingAcoe(true);
    try {
      const res = await api.addAcoeUser(acoeForm);
      if (res.success) {
        setNotification({ type: 'success', message: res.message || 'New ACOE user appointed.' });
        await loadAcoeUsers();
        setAcoeForm({
          email: '',
          name: '',
          password: 'Acoe@123',
          role: 'ACOE',
          streamScope: 'ENGINEERING',
        });
      } else {
        setNotification({ type: 'error', message: res.message || 'Failed to appoint ACOE user.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Error creating ACOE user account.' });
    } finally {
      setIsAddingAcoe(false);
    }
  };

  // Handle Password Change
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeStatus(null);
    if (!newPasswordVal.trim()) {
      setPasswordChangeStatus({ type: 'error', message: 'New password cannot be empty.' });
      return;
    }
    if (newPasswordVal !== confirmPasswordVal) {
      setPasswordChangeStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const targetEmail = currentCoeUser?.email || adminEmail;
      const res = await api.changeCoePassword(targetEmail, newPasswordVal);
      if (res.success) {
        setPasswordChangeStatus({ type: 'success', message: 'Password updated successfully!' });
        if (currentCoeUser) {
          const updated = { ...currentCoeUser, isDefaultPassword: false };
          setCurrentCoeUser(updated);
          sessionStorage.setItem('coe_user_data', JSON.stringify(updated));
        }
        setTimeout(() => {
          setShowPasswordModal(false);
          setNewPasswordVal('');
          setConfirmPasswordVal('');
          setPasswordChangeStatus(null);
        }, 1500);
      } else {
        setPasswordChangeStatus({ type: 'error', message: res.message || 'Failed to change password.' });
      }
    } catch {
      setPasswordChangeStatus({ type: 'error', message: 'Error changing password.' });
    } finally {
      setIsChangingPassword(false);
    }
  };



  // Handle Save Drive & Sheet Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setNotification(null);

    try {
      const res = await api.updateCoeConfig({
        driveFolderUrl: driveUrlInput.trim(),
        spreadsheetUrl: sheetUrlInput.trim(),
        scriptUrl: scriptUrlInput.trim(),
        convocationBatch: batchInput.trim(),
        academicYear: yearInput.trim(),
      });

      if (res.success) {
        setNotification({
          type: 'success',
          message: 'Google Drive folder and Spreadsheet settings updated successfully.',
        });
        await loadCoeData();
      } else {
        setNotification({
          type: 'error',
          message: res.message || 'Failed to update settings.',
        });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error updating settings.' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Handle Add HOD
  const handleAddHod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hodForm.name.trim() || !hodForm.email.trim() || !hodForm.department.trim()) {
      setNotification({ type: 'error', message: 'Name, official email, and department are required.' });
      return;
    }

    setIsAddingHod(true);
    setNotification(null);

    try {
      const res = await api.addHod({
        name: hodForm.name.trim(),
        email: hodForm.email.trim(),
        department: hodForm.department.trim(),
        specialization: hodForm.specialization.trim() || 'ALL',
      });

      if (res.success) {
        setNotification({
          type: 'success',
          message: `Head of Department for ${hodForm.department} assigned successfully.`,
        });
        setHodForm({
          name: '',
          email: '',
          department: 'AERONAUTICAL ENGINEERING',
          specialization: 'ALL',
        });
        await loadCoeData();
      } else {
        setNotification({ type: 'error', message: res.message || 'Failed to assign HOD.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Error submitting HOD details.' });
    } finally {
      setIsAddingHod(false);
    }
  };

  // Handle CSV Import
  const handleImportCsv = async () => {
    if (!csvContent.trim()) {
      setNotification({ type: 'error', message: 'Please paste CSV content or upload a file first.' });
      return;
    }

    setIsImporting(true);
    setNotification(null);

    try {
      const lines = csvContent.trim().split('\n').filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setNotification({ type: 'error', message: 'CSV must contain at least a header and one data row.' });
        setIsImporting(false);
        return;
      }

      const rows = lines.slice(1).map((line) => {
        // Simple comma split handling quotes
        const match = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        return (match || line.split(',')).map((c) => c.replace(/^"|"$/g, '').trim());
      });

      let payload: any = {};

      if (sheetTabSelect === 'Student_data') {
        // Columns: REGISTER NUMBER, NAME, FATHER NAME, GENDER, DATE OF BIRTH, NATIONALITY, YEAR, BRANCH, SPECIALIZATION
        const parsed = rows.map((r) => ({
          registerNumber: r[0] || '',
          name: r[1] || '',
          fatherName: r[2] || '',
          gender: r[3] || '',
          dob: r[4] || '',
          nationality: r[5] || '',
          year: r[6] || 'IV',
          branch: r[7] || '',
          specialization: r[8] || '',
        }));
        payload = { students: parsed };
      } else if (sheetTabSelect === 'Faculty') {
        // Columns: Email, Name, Role, Department, Specialization, Semester, Batch, Section
        const parsed = rows.map((r) => ({
          email: r[0] || '',
          name: r[1] || '',
          role: (r[2] || 'TEACHER').toUpperCase() as any,
          department: r[3] || '',
          specialization: r[4] || 'ALL',
          semester: r[5] || 'ALL',
          batch: r[6] || 'ALL',
          section: r[7] || 'A',
        }));
        payload = { faculty: parsed };
      } else if (sheetTabSelect === 'Submissions') {
        // Columns: Submission_ID, Student_Email, Register_Number, Student_Name, Father_Name, Gender, DOB, Nationality, Department_Branch, Specialization, Semester, Section, Batch, Photo_Upload, Final_Drive_URL, Proof_10th_URL, Proof_TC_URL, Validation_Notes, Approval_Status, Teacher_Remarks, HOD_Remarks, Dean_Remarks
        const parsed = rows.map((r, idx) => ({
          submissionId: r[0] || `sub-${Date.now()}-${idx}`,
          studentEmail: r[1] || '',
          registerNumber: r[2] || '',
          studentName: r[3] || '',
          fatherName: r[4] || '',
          gender: r[5] || '',
          dob: r[6] || '',
          nationality: r[7] || '',
          departmentBranch: r[8] || '',
          specialization: r[9] || '',
          semester: r[10] || 'VIII',
          section: r[11] || '',
          batch: r[12] || '',
          photoUpload: r[13] || '',
          finalDriveUrl: r[14] || '',
          proof10thUrl: r[15] || '',
          proofTcUrl: r[16] || '',
          validationNotes: r[17] || '',
          approvalStatus: (r[18] || 'PENDING_TEACHER') as any,
          teacherRemarks: r[19] || '',
          hodRemarks: r[20] || '',
          deanRemarks: r[21] || '',
        }));
        payload = { submissions: parsed };
      }

      const res = await api.importSheets(payload);
      if (res.success) {
        setNotification({
          type: 'success',
          message: `Successfully imported ${rows.length} records into '${sheetTabSelect}' sheet.`,
        });
        setCsvContent('');
        await loadCoeData();
      } else {
        setNotification({ type: 'error', message: res.message || 'Import failed.' });
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: 'Failed to parse CSV: ' + (e.message || 'Format error') });
    } finally {
      setIsImporting(false);
    }
  };

  // Download template CSV
  const handleDownloadTemplate = (tab: 'Student_data' | 'Submissions' | 'Faculty') => {
    let content = '';
    let filename = '';

    if (tab === 'Student_data') {
      content = 'REGISTER NUMBER,NAME,FATHER NAME,GENDER,DATE OF BIRTH,NATIONALITY,YEAR,BRANCH,SPECIALIZATION\n';
      content += '20134001,John Doe,Robert Doe,Male,2002-05-14,Indian,IV,AERONAUTICAL ENGINEERING,Avionics\n';
      filename = 'Student_data_template.csv';
    } else if (tab === 'Faculty') {
      content = 'Email,Name,Role,Department,Specialization,Semester,Batch,Section\n';
      content += 'hod.aero@hindustanuniv.ac.in,Dr. K. Ramesh,HOD,AERONAUTICAL ENGINEERING,ALL,ALL,ALL,ALL\n';
      content += 'teacher.aero@hindustanuniv.ac.in,Prof. S. Anita,TEACHER,AERONAUTICAL ENGINEERING,Avionics,VIII,Batch A,A\n';
      filename = 'Faculty_directory_template.csv';
    } else {
      content = 'Submission_ID,Student_Email,Register_Number,Student_Name,Father_Name,Gender,DOB,Nationality,Department_Branch,Specialization,Semester,Section,Batch,Photo_Upload,Final_Drive_URL,Proof_10th_URL,Proof_TC_URL,Validation_Notes,Approval_Status,Teacher_Remarks,HOD_Remarks,Dean_Remarks\n';
      filename = 'Submissions_template.csv';
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered submissions
  const filteredSubmissions = submissions.filter((s) => {
    if (filterDept !== 'ALL' && s.departmentBranch.toUpperCase() !== filterDept.toUpperCase()) {
      return false;
    }
    if (filterStatus !== 'ALL' && s.approvalStatus !== filterStatus) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchReg = s.registerNumber.toLowerCase().includes(q);
      const matchName = s.studentName.toLowerCase().includes(q);
      const matchEmail = s.studentEmail.toLowerCase().includes(q);
      if (!matchReg && !matchName && !matchEmail) return false;
    }
    return true;
  });

  // Unique departments for filter
  const departmentsList = Array.from(
    new Set([
      'AERONAUTICAL ENGINEERING',
      'AEROSPACE ENGINEERING',
      'COMPUTER SCIENCE AND ENGINEERING',
      'INFORMATION TECHNOLOGY',
      'MECHANICAL ENGINEERING',
      'CIVIL ENGINEERING',
      'ELECTRICAL AND ELECTRONICS ENGINEERING',
      'ELECTRONICS AND COMMUNICATION ENGINEERING',
      ...submissions.map((s) => s.departmentBranch).filter(Boolean),
    ])
  );

  // -------------------------------------------------------------
  // RENDER 1: AUTHENTICATION SCREEN FOR COE & ACOE
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-700 to-indigo-700 text-white flex items-center justify-center mx-auto shadow-md mb-3">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Controller of Examinations
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Multi-Role Convocation Clearance Governance
            </p>

            {/* User Guide Card for COE Admin */}
            <div className="mt-4 p-4 bg-purple-50/70 border border-purple-200 rounded-2xl text-left space-y-2">
              <div className="font-bold text-purple-900 text-xs flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-purple-700" />
                <span>What Details Are Needed For COE / ACOE Admin:</span>
              </div>
              <ul className="text-[11px] text-purple-800 space-y-1 list-disc list-inside">
                <li><strong>Official ACOE Email</strong> (@hindustanuniv.ac.in) for secure Email OTP login.</li>
                <li><strong>Stream Scope</strong> (Engineering vs Non-Engineering clearance queue oversight).</li>
                <li><strong>Google Drive Storage Folder URL</strong> where uploaded student photos are saved.</li>
                <li><strong>Google Sheets Master URL</strong> for student database synchronization.</li>
              </ul>
            </div>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}


          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ACOE Official Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="acoe1@hindustanuniv.ac.in"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all font-mono"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  ACOE officers log in securely via 6-Digit Email Passcode (OTP). No password required.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isSubmittingAuth ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending OTP Code...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Send Email Security Passcode (OTP)
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    6-Digit Security Code (OTP)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpInput('');
                    }}
                    className="text-[11px] text-purple-700 hover:underline font-medium cursor-pointer"
                  >
                    Change Email
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm tracking-widest text-center font-mono focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                    required
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 text-center">
                  Passcode delivered to <span className="font-semibold text-slate-700">{adminEmail}</span>.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isSubmittingAuth ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Verifying Credentials...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Enter COE Control Portal
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400">
              DegreeFrame Academic Governance System • HITS
            </span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER 2: AUTHENTICATED COE DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Top Banner & Profile */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <ShieldCheck className="w-72 h-72" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-purple-400/20 text-purple-200 border border-purple-400/30">
                {currentCoeUser?.role === 'SUPER_ADMIN' ? 'Chief COE Super Admin' : 'Assistant COE (ACOE)'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                Scope: {currentCoeUser?.streamScope || 'ALL'}
              </span>
              <span className="text-xs text-purple-200/80 font-medium">
                {settings.convocationBatch} • {settings.academicYear}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <span>Controller of Examinations</span>
              <span className="text-sm font-normal text-purple-200/80 bg-white/10 px-3 py-1 rounded-full border border-white/10">
                {currentCoeUser?.name || adminEmail}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-purple-200/90 mt-1 max-w-2xl">
              {currentCoeUser?.streamScope === 'ENGINEERING'
                ? 'Managing Engineering degree photo clearances & HOD assignments.'
                : currentCoeUser?.streamScope === 'NON_ENGINEERING'
                ? 'Managing Non-Engineering degree photo clearances & HOD assignments.'
                : 'Master control hub for overall degree clearance, Google Drive/Sheet routing, and ACOE appointments.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            <button
              onClick={() => setIsManualOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-sm transition-all flex items-center gap-1.5 cursor-pointer border border-white/20"
            >
              <BookOpen className="w-3.5 h-3.5" />
              COE Manual
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-400/30 text-xs font-semibold backdrop-blur-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>



      {/* Global Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-center justify-between shadow-xs transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          System Overview
        </button>

        <button
          onClick={() => setActiveTab('drive')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'drive'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          Drive & Sheet Config
        </button>

        <button
          onClick={() => setActiveTab('hods')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'hods'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Assign HOD Details
        </button>

        <button
          onClick={() => setActiveTab('sheets')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'sheets'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Master Google Sheet
        </button>

        <button
          onClick={() => setActiveTab('submissions')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'submissions'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          Submissions Audit ({submissions.length})
        </button>
      </div>



      {/* ------------------------------------------------------------- */}
      {/* TAB 1: SYSTEM OVERVIEW */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold">Total Students</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{stats.totalStudents}</div>
              <p className="text-[11px] text-slate-400 mt-1">From Student_data sheet</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold">Total Submissions</span>
                <FileText className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{stats.totalSubmissions}</div>
              <p className="text-[11px] text-slate-400 mt-1">Convocation photos submitted</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold">Approved Degrees</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-700">{stats.approved}</div>
              <p className="text-[11px] text-slate-400 mt-1">Cleared for final print</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold">In Review Pipeline</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-extrabold text-amber-700">
                {stats.pendingTeacher + stats.pendingHod}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {stats.pendingTeacher} Teacher • {stats.pendingHod} HOD
              </p>
            </div>
          </div>

          {/* Quick Authority Hierarchy Diagram */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-700" />
              Institutional Authority Flow & Clearances
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200">
                <div className="text-xs font-bold text-purple-900 uppercase tracking-wider mb-1">
                  1. Controller (COE)
                </div>
                <p className="text-[11px] text-purple-700">
                  Assigns HODs, configures Google Drive destination folder & imports master student data.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200">
                <div className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">
                  2. Head of Dept (HOD)
                </div>
                <p className="text-[11px] text-blue-700">
                  Assigns Class Teachers for sections; conducts secondary approval of photos & details.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200">
                <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1">
                  3. Class Teacher
                </div>
                <p className="text-[11px] text-indigo-700">
                  Performs first-line inspection of uploaded passport photo (&lt; 80KB, 35x40mm) & proof.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200">
                <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-1">
                  4. Final Clearance
                </div>
                <p className="text-[11px] text-emerald-700">
                  Verified degree records pushed into Google Sheet and Drive folder for convocation print.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: GOOGLE DRIVE & MASTER SHEET CONFIGURATION */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'drive' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-2xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-purple-700" />
              Target Google Drive & Master Sheet Configuration
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Specify the Master Google Spreadsheet and target Google Drive storage folder for the institution. Student details are fetched directly from the <code className="text-purple-700 font-bold">Student_data</code> tab, uploaded photos are saved as <code className="text-purple-700 font-bold">&lt;RegisterNumber&gt;.jpg</code> in the Google Drive folder, and submission records and faculty appointments are saved in the <code className="text-purple-700 font-bold">Submissions</code> and <code className="text-purple-700 font-bold">Faculty</code> tabs.
            </p>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Target Google Drive Storage Folder URL or Folder ID *
              </label>
              <input
                type="text"
                value={driveUrlInput}
                onChange={(e) => setDriveUrlInput(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/1w3hVMlTQNVUh7Bpru_cwlEJ6TQ77kfqI"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                All student passport portrait photographs will be uploaded directly as <code className="text-purple-700 font-bold">&lt;RegisterNumber&gt;.jpg</code> inside this destination Google Drive folder.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Master Google Spreadsheet URL or Spreadsheet ID *
              </label>
              <input
                type="text"
                value={sheetUrlInput}
                onChange={(e) => setSheetUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1a-wxvfyMzC6zmcyoWBFzzrFjysyituOVfvoXtxvVNPQ/edit"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Connected 3-tab Google Sheet: <code className="text-purple-700 font-bold">Student_data</code> (auto-read profiles), <code className="text-purple-700 font-bold">Submissions</code> (live submissions), and <code className="text-purple-700 font-bold">Faculty</code> (HOD & Teacher directory).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Academic Year
                </label>
                <input
                  type="text"
                  value={yearInput}
                  onChange={(e) => setYearInput(e.target.value)}
                  placeholder="2024-2025"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Convocation Ceremony Name / Batch
                </label>
                <input
                  type="text"
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  placeholder="34th Convocation Ceremony"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSavingConfig}
                className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all flex items-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isSavingConfig ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving Drive & Sheet Config...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Save Drive & Sheet Settings
                  </>
                )}
              </button>

              {settings.driveFolderUrl && (
                <a
                  href={settings.driveFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4 text-purple-700" />
                  Open Live Drive Folder
                </a>
              )}

              {settings.spreadsheetUrl && (
                <a
                  href={settings.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4 text-purple-700" />
                  Open Live Google Sheet
                </a>
              )}
            </div>
          </form>

          {/* Folder & Sheet Architecture Summary */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 max-w-2xl space-y-3">
            <span className="font-bold text-slate-800 block">System Connection Architecture:</span>
            <div className="font-mono text-[11px] space-y-1.5 text-slate-700">
              <div>📁 <strong>Target Google Drive Folder:</strong> <code className="text-purple-700 font-bold">{settings.driveFolderId || '1w3hVMlTQNVUh7Bpru_cwlEJ6TQ77kfqI'}</code></div>
              <div className="pl-4 text-slate-500">└── 🖼️ &lt;RegisterNumber&gt;.jpg (Saved directly without subfolders)</div>
              <div className="pt-1">📊 <strong>Master Google Spreadsheet:</strong> <code className="text-purple-700 font-bold">{settings.spreadsheetId || '1a-wxvfyMzC6zmcyoWBFzzrFjysyituOVfvoXtxvVNPQ'}</code></div>
              <div className="pl-4 text-slate-500">├── 📄 <strong>Student_data</strong> (9 cols: RegNo, Name, Father Name, DOB, Gender, etc.)</div>
              <div className="pl-4 text-slate-500">├── 📄 <strong>Submissions</strong> (22 cols: Submissions, Drive URLs, Approval Status)</div>
              <div className="pl-4 text-slate-500">└── 📄 <strong>Faculty</strong> (8 cols: ACOEs, HODs, and Class Teachers)</div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: ASSIGN HEAD OF DEPARTMENT (HOD) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'hods' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-2xs">
            <div className="mb-6">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-700" />
                Appoint Department HOD Details
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                The COE assigns the Head of Department (HOD) for each academic branch. The appointed HOD will gain authorization to appoint Class Teachers and approve convocation submissions for their department.
              </p>
            </div>

            <form onSubmit={handleAddHod} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    HOD Full Name & Designation
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={hodForm.name}
                      onChange={(e) => setHodForm({ ...hodForm, name: e.target.value })}
                      placeholder="Dr. K. Ramesh, Professor & Head"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Official HOD Email ID (@hindustanuniv.ac.in)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={hodForm.email}
                      onChange={(e) => setHodForm({ ...hodForm, email: e.target.value })}
                      placeholder="hod.aero@hindustanuniv.ac.in"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Department / Academic Branch
                  </label>
                  <select
                    value={hodForm.department}
                    onChange={(e) => setHodForm({ ...hodForm, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                  >
                    {departmentsList.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Specialization Authority Scope
                  </label>
                  <input
                    type="text"
                    value={hodForm.specialization}
                    onChange={(e) => setHodForm({ ...hodForm, specialization: e.target.value })}
                    placeholder="ALL (or specific specialization)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isAddingHod}
                className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all flex items-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isAddingHod ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Assigning HOD in Database...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Appoint Head of Department
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Currently Assigned HODs Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs">
            <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Building className="w-4 h-4 text-purple-700" />
              Appointed Heads of Departments ({hods.length})
            </h4>

            {hods.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No HODs currently assigned. Use the form above to appoint department heads.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 px-3 font-semibold">Department</th>
                      <th className="py-2.5 px-3 font-semibold">HOD Name</th>
                      <th className="py-2.5 px-3 font-semibold">Official Email</th>
                      <th className="py-2.5 px-3 font-semibold">Scope</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hods.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {h.department}
                        </td>
                        <td className="py-3 px-3 text-slate-800 font-medium">{h.name}</td>
                        <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{h.email}</td>
                        <td className="py-3 px-3 text-slate-600">{h.specialization}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            Active HOD
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: MASTER GOOGLE SHEET ARCHITECTURE & SYNC */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'sheets' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-purple-700" />
                  Master Google Sheet Live Database
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  All student records, faculty appointments, and clearance submissions are automatically read from and saved directly to your connected 3-tab Master Google Sheet.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start">
                <button
                  type="button"
                  onClick={downloadMasterExcelTemplate}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download 3-Tab Master Excel (.xlsx)
                </button>

                {settings.spreadsheetUrl && (
                  <a
                    href={settings.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 transition-all flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Live Google Sheet
                  </a>
                )}
              </div>
            </div>

            {/* Master Google Spreadsheet URL Config */}
            <form onSubmit={handleSaveConfig} className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Master Google Spreadsheet URL or ID
                </label>
                <input
                  type="text"
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1a-wxvfyMzC6zmcyoWBFzzrFjysyituOVfvoXtxvVNPQ/edit"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  No separate student upload is required—students are fetched directly from the <code className="text-purple-700">Student_data</code> tab of this Master Sheet.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {isSavingConfig ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Syncing Master Sheet...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Save & Sync Master Google Sheet
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* 3-Tab Automated Data Flow Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-bold text-slate-900 mb-1 flex items-center justify-between">
                  <span>1. Student_data (9 Cols)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800">Auto-Read</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Pre-populated in your Master Google Sheet. When a student enters their Register Number, their profile is fetched directly from this tab.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-bold text-slate-900 mb-1 flex items-center justify-between">
                  <span>2. Faculty (8 Cols)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-800">Auto-Saved</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Whenever Super Admin adds an ACOE, COE assigns a Department HOD, or an HOD assigns a Class Teacher, it is automatically saved to this tab.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-bold text-slate-900 mb-1 flex items-center justify-between">
                  <span>3. Submissions (22 Cols)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800">Auto-Saved</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Student photo submissions (<code className="text-emerald-800">&lt;RegNo&gt;.jpg</code> Drive URLs) and Class Teacher / HOD approvals are automatically recorded in this tab.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: SUBMISSIONS AUDIT TABLE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'submissions' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-700" />
                Convocation Degree Photo Clearance Audit
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Institutional oversight of student submissions, review notes, and certificate approvals.
              </p>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Reg No or Name..."
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white"
                />
              </div>

              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              >
                <option value="ALL">All Departments</option>
                {departmentsList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING_TEACHER">Pending Teacher</option>
                <option value="PENDING_HOD">Pending HOD</option>
                <option value="REJECTED_BY_TEACHER">Rejected by Teacher</option>
                <option value="REJECTED_BY_HOD">Rejected by HOD</option>
              </select>
            </div>
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">
              No submission records found matching your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                    <th className="py-2.5 px-3 font-semibold">Photo</th>
                    <th className="py-2.5 px-3 font-semibold">Reg Number</th>
                    <th className="py-2.5 px-3 font-semibold">Student Name</th>
                    <th className="py-2.5 px-3 font-semibold">Semester</th>
                    <th className="py-2.5 px-3 font-semibold">Department & Sec</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Remarks & Notes</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubmissions.map((sub) => {
                    const isApproved = sub.approvalStatus === 'APPROVED';
                    const isPending = sub.approvalStatus.startsWith('PENDING');
                    return (
                      <tr key={sub.submissionId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          {sub.finalDriveUrl ? (
                            <img
                              src={sub.finalDriveUrl}
                              alt={sub.registerNumber}
                              className="w-9 h-11 object-cover rounded-md border border-slate-200 shadow-2xs"
                            />
                          ) : (
                            <div className="w-9 h-11 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                              N/A
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {sub.registerNumber}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {sub.studentName}
                          <div className="text-[10px] text-slate-400">{sub.studentEmail}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-blue-700">
                          <span className="bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                            Sem {sub.semester || 'VIII'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          <div>{sub.departmentBranch}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Sec {sub.section} • {sub.batch}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : isPending
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}
                          >
                            {sub.approvalStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                          {sub.teacherRemarks || sub.hodRemarks || sub.validationNotes || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setInspectRecord(sub)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-600 text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* RECORD INSPECTION MODAL */}
      {/* ------------------------------------------------------------- */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setInspectRecord(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Convocation Record: {inspectRecord.registerNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Submission ID: {inspectRecord.submissionId}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
              <div className="text-center">
                <span className="text-xs font-semibold text-slate-600 block mb-2">
                  Passport Portrait Photo
                </span>
                {inspectRecord.finalDriveUrl ? (
                  <img
                    src={inspectRecord.finalDriveUrl}
                    alt={inspectRecord.studentName}
                    className="w-36 h-44 object-cover rounded-xl border border-slate-200 shadow-md mx-auto"
                  />
                ) : (
                  <div className="w-36 h-44 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-xs text-slate-400 mx-auto">
                    No Photo
                  </div>
                )}
                <span className="text-[10px] text-slate-400 mt-2 block">
                  Target: {inspectRecord.photoUpload || `${inspectRecord.registerNumber}.jpg`}
                </span>
              </div>

              <div className="sm:col-span-2 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Student Name</span>
                    <span className="font-semibold text-slate-800">{inspectRecord.studentName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Father Name</span>
                    <span className="font-semibold text-slate-800">{inspectRecord.fatherName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Gender / DOB</span>
                    <span className="font-semibold text-slate-800">
                      {inspectRecord.gender} • {inspectRecord.dob}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Nationality</span>
                    <span className="font-semibold text-slate-800">{inspectRecord.nationality}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">Branch / Specialization</span>
                    <span className="font-semibold text-slate-800">
                      {inspectRecord.departmentBranch} ({inspectRecord.specialization})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Semester</span>
                    <span className="font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded font-mono text-[11px] inline-block">
                      Sem {inspectRecord.semester || 'VIII'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Section & Batch</span>
                    <span className="font-semibold text-slate-800">
                      Sec {inspectRecord.section} • {inspectRecord.batch}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Approval Status</span>
                    <span className="font-bold text-purple-700">{inspectRecord.approvalStatus}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
                    <span className="font-semibold text-slate-700 block">Class Teacher Remarks:</span>
                    <span className="text-slate-600">{inspectRecord.teacherRemarks || 'None recorded'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
                    <span className="font-semibold text-slate-700 block">Head of Department Remarks:</span>
                    <span className="text-slate-600">{inspectRecord.hodRemarks || 'None recorded'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
                    <span className="font-semibold text-slate-700 block">Validation Notes:</span>
                    <span className="text-slate-600">{inspectRecord.validationNotes || 'None'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setInspectRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ------------------------------------------------------------- */}
      {/* CHANGE PASSWORD MODAL */}
      {/* ------------------------------------------------------------- */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Change Account Password</h3>
                  <p className="text-xs text-slate-500">{currentCoeUser?.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordChangeStatus && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  passwordChangeStatus.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {passwordChangeStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                )}
                <span>{passwordChangeStatus.message}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Security Password *
                </label>
                <input
                  type="password"
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={confirmPasswordVal}
                  onChange={(e) => setConfirmPasswordVal(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isChangingPassword ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Manual Modal */}
      <UserManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} defaultRole="coe" />
    </div>
  );
};

