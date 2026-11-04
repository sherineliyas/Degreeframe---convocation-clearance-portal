import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { storage } from '../services/store';
import { StudentRecord, SubmissionRecord } from '../types';
import { parseHash } from '../utils/router';
import { PhotoGuidelineModal } from './PhotoGuidelineModal';
import { UserManualModal } from './UserManualModal';
import {
  StepProgressIndicator,
  ReviewStateProgressIndicator,
} from './StudentProgressIndicator';
import {
  User,
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  ArrowRight,
  ArrowLeft,
  Info,
  Clock,
  Sparkles,
  Camera,
  XCircle,
  Eye,
  RefreshCw,
  LogOut,
  SlidersHorizontal,
  BookOpen,
} from 'lucide-react';

export type ProgramStream = 'UG_ENGG' | 'UG_NON_ENGG' | 'PG_2YR';

export function detectProgramStream(branch: string = '', spec: string = ''): ProgramStream {
  const text = (branch + ' ' + spec).toUpperCase();
  if (
    text.includes('M.TECH') ||
    text.includes('M.E') ||
    text.includes('MBA') ||
    text.includes('MCA') ||
    text.includes('M.SC') ||
    text.includes('M.A') ||
    text.includes('MASTER') ||
    text.includes('PG')
  ) {
    return 'PG_2YR';
  }
  if (
    text.includes('BCA') ||
    text.includes('B.SC') ||
    text.includes('B.COM') ||
    text.includes('BBA') ||
    text.includes('B.A') ||
    text.includes('ARTS') ||
    text.includes('COMMERCE') ||
    text.includes('SCIENCE')
  ) {
    return 'UG_NON_ENGG';
  }
  // Default is 4-Year UG Engineering (B.Tech / B.E. / CSE / ECE / MECH / AERO / etc.)
  return 'UG_ENGG';
}

export function getStreamInfo(stream: ProgramStream) {
  switch (stream) {
    case 'UG_ENGG':
      return {
        label: 'UG Engineering Program (4-Year)',
        semesters: ['VII', 'VIII'],
        defaultSem: 'VIII',
        explanation: '4-Year UG Engineering program final-year students can enter their semester as either VII or VIII.',
      };
    case 'UG_NON_ENGG':
      return {
        label: 'UG Non-Engineering Program (3-Year)',
        semesters: ['V', 'VI'],
        defaultSem: 'VI',
        explanation: '3-Year UG Non-Engineering program final-year students can enter their semester as either V or VI.',
      };
    case 'PG_2YR':
      return {
        label: 'PG Program - Engg & Non-Engg (2-Year)',
        semesters: ['III', 'IV'],
        defaultSem: 'IV',
        explanation: '2-Year PG program (Engineering and Non-Engineering) final-year students can enter their semester as either III or IV.',
      };
  }
}

export const StudentPortal: React.FC = () => {
  // Auth state
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);

  // Tab state
  const [activeTab, setActiveTabState] = useState<'upload' | 'track'>('upload');

  const setActiveTab = (tab: 'upload' | 'track') => {
    setActiveTabState(tab);
    if (tab === 'track') {
      window.location.hash = '#/student/track';
    } else {
      window.location.hash = '#/student';
    }
  };

  useEffect(() => {
    const route = parseHash();
    if (route.portal === 'student' && route.subPath === 'track') {
      setActiveTabState('track');
    }
  }, []);

  // Step 1: Lookup state
  const [lookupRegNo, setLookupRegNo] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [alreadySubmittedInfo, setAlreadySubmittedInfo] = useState<any | null>(null);

  // Step 2 & 3: Form state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [originalData, setOriginalData] = useState<StudentRecord | null>(null);
  const [formData, setFormData] = useState({
    registerNumber: '',
    studentName: '',
    fatherName: '',
    gender: 'MALE',
    dob: '',
    nationality: 'INDIAN',
    department: '',
    specialization: '',
    programStream: 'UG_ENGG' as ProgramStream,
    semester: 'VIII',
    section: 'A',
    batch: 'Batch A',
    confirmed: false,
  });

  // Proofs & Photo
  const [proof10thFile, setProof10thFile] = useState<{ name: string; data: string; mime: string } | null>(null);
  const [proofTcFile, setProofTcFile] = useState<{ name: string; data: string; mime: string } | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoSizeKb, setPhotoSizeKb] = useState<number>(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<{ id: string; message: string } | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(false);

  // Track status state
  const [trackQuery, setTrackQuery] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackResult, setTrackResult] = useState<any | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  // Auto-correction flags
  const isNameCorrected =
    originalData && formData.studentName.trim().toLowerCase() !== originalData.name.trim().toLowerCase();
  const isFatherCorrected =
    originalData && formData.fatherName.trim().toLowerCase() !== originalData.fatherName.trim().toLowerCase();
  const isGenderCorrected =
    originalData && formData.gender.trim().toLowerCase() !== originalData.gender.trim().toLowerCase();
  const isDobCorrected = originalData && formData.dob.trim() !== originalData.dob.trim();
  const isNationalityCorrected =
    originalData && formData.nationality.trim().toLowerCase() !== originalData.nationality.trim().toLowerCase();

  const requires10thProof = Boolean(isNameCorrected);
  const requiresTcProof = Boolean(
    isFatherCorrected || isGenderCorrected || isDobCorrected || isNationalityCorrected
  );

  // 1. Send OTP
  const handleSendOtp = async () => {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      let targetEmail = email.toLowerCase().trim();
      if (!targetEmail) {
        setAuthMessage({ text: 'Please enter your student email or Register Number.', type: 'error' });
        setAuthLoading(false);
        return;
      }
      if (!targetEmail.includes('@')) {
        targetEmail = targetEmail + '@student.hindustanuniv.ac.in';
        setEmail(targetEmail);
      }
      if (!targetEmail.endsWith('@student.hindustanuniv.ac.in')) {
        setAuthMessage({ text: 'Student email must be in the format @student.hindustanuniv.ac.in', type: 'error' });
        setAuthLoading(false);
        return;
      }

      const res = await api.sendOtp(targetEmail, 'student');
      if (res.success) {
        setOtpSent(true);
        setAuthMessage({ text: res.message || 'OTP sent successfully', type: 'success' });
      } else {
        setAuthMessage({ text: res.message || 'Failed to send OTP', type: 'error' });
      }
    } catch (e: any) {
      setAuthMessage({ text: e.message || 'Error sending OTP', type: 'error' });
    } finally {
      setAuthLoading(false);
    }
  };

  // 2. Verify OTP
  const handleVerifyOtp = async () => {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      const res = await api.verifyOtp(email, otp, 'student');
      if (res.success) {
        setIsAuthenticated(true);
        setAuthMessage(null);
      } else {
        setAuthMessage({ text: res.message || 'Verification failed', type: 'error' });
      }
    } catch (e: any) {
      setAuthMessage({ text: e.message || 'Error verifying OTP', type: 'error' });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setOtpSent(false);
    setOtp('');
    setStep(1);
    setOriginalData(null);
    setSubmitSuccess(null);
  };

  // 3. Fetch student records
  const handleLookup = async (regToFetch?: string) => {
    const targetReg = (regToFetch || lookupRegNo).trim();
    if (!targetReg) {
      setLookupError('Please enter a valid Register Number.');
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setAlreadySubmittedInfo(null);

    try {
      const res = await api.getStudentData(targetReg);
      if (res.success && res.alreadySubmitted) {
        setAlreadySubmittedInfo(res.data);
      } else if (res.success && res.data) {
        const d = res.data;
        const studentObj: StudentRecord = {
          registerNumber: d.registerNumber || d.regNo,
          name: d.studentName || d.name,
          fatherName: d.fatherName,
          gender: (d.gender || 'MALE').toUpperCase(),
          dob: d.dob || '',
          nationality: d.nationality || 'INDIAN',
          year: d.year || '2024',
          branch: d.department || d.branch || '',
          specialization: d.specialization || 'GENERAL',
        };
        const detectedStream = detectProgramStream(studentObj.branch, studentObj.specialization);
        const info = getStreamInfo(detectedStream);
        setOriginalData(studentObj);
        setFormData({
          registerNumber: studentObj.registerNumber,
          studentName: studentObj.name,
          fatherName: studentObj.fatherName,
          gender: studentObj.gender,
          dob: studentObj.dob,
          nationality: studentObj.nationality,
          department: studentObj.branch,
          specialization: studentObj.specialization,
          programStream: detectedStream,
          semester: info.defaultSem,
          section: 'A',
          batch: 'Batch A',
          confirmed: false,
        });
        setStep(2);
      } else {
        setLookupError(res.message || 'Register Number not found in student records.');
      }
    } catch (e: any) {
      setLookupError(e.message || 'Error querying records');
    } finally {
      setLookupLoading(false);
    }
  };

  // Handle file base64 read
  const handleFileRead = (file: File): Promise<{ data: string; mime: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({
          data: result,
          mime: file.type || 'application/octet-stream',
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle Photo selection & limit check
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhotoError(null);
    if (!file) {
      setPhotoDataUrl(null);
      setPhotoSizeKb(0);
      return;
    }

    const kb = Number((file.size / 1024).toFixed(1));
    setPhotoSizeKb(kb);

    if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') {
      setPhotoError('Photo must be in JPEG (.jpg / .jpeg) format only.');
      setPhotoDataUrl(null);
      return;
    }

    if (file.size > 80 * 1024) {
      setPhotoError(`Photo size is ${kb} KB, which exceeds the strictly enforced 80 KB limit. You can use the one-click optimizer below.`);
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Auto-compress photo to 75KB via HTML5 canvas
  const handleAutoCompressPhoto = () => {
    if (!photoDataUrl) return;
    const img = new Image();
    img.src = photoDataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // 35mm x 40mm proportional: approx 350x400 px
      canvas.width = 350;
      canvas.height = 400;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Compress with quality 0.75
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        // Calculate size in KB
        const stringLength = compressedDataUrl.length - 'data:image/jpeg;base64,'.length;
        const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624896334383;
        const kb = Number((sizeInBytes / 1024).toFixed(1));
        setPhotoDataUrl(compressedDataUrl);
        setPhotoSizeKb(kb);
        setPhotoError(null);
      }
    };
  };


  // Step 2 Proceed to Step 3
  const handleProceedToPhoto = () => {
    if (!formData.confirmed) {
      alert('Please check the confirmation declaration before proceeding.');
      return;
    }
    if (!formData.semester?.trim()) {
      alert('Please select your final-year Semester.');
      return;
    }
    if (!formData.section.trim()) {
      alert('Please enter your Section.');
      return;
    }
    if (requires10thProof && !proof10thFile) {
      alert('10th Marksheet Proof Document is required because your Name was edited.');
      return;
    }
    if (requiresTcProof && !proofTcFile) {
      alert('Transfer Certificate (TC) Proof Document is required for the profile corrections made.');
      return;
    }
    setStep(3);
  };

  // Final Submit
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoDataUrl) {
      setPhotoError('Passport photograph is required.');
      return;
    }
    if (photoSizeKb > 80) {
      setPhotoError('Please compress your photo to under 80 KB before submitting.');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        registerNumber: formData.registerNumber,
        studentEmail: email,
        studentName: formData.studentName,
        fatherName: formData.fatherName,
        gender: formData.gender,
        dob: formData.dob,
        nationality: formData.nationality,
        department: formData.department,
        specialization: formData.specialization,
        semester: formData.semester,
        section: formData.section,
        batch: formData.batch,

        isNameCorrected,
        isFatherCorrected,
        isGenderCorrected,
        isDobCorrected,
        isNationalityCorrected,

        photoData: photoDataUrl,
        proof10thData: proof10thFile?.data || '',
        proof10thMime: proof10thFile?.mime || '',
        proofTcData: proofTcFile?.data || '',
        proofTcMime: proofTcFile?.mime || '',
      };

      const res = await api.submitApplication(payload);
      if (res.success) {
        setSubmitSuccess({
          id: res.trackingId || 'SUB-OK',
          message: res.message || 'Application submitted successfully!',
        });
      } else {
        alert(res.message || 'Submission failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Error during submission');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Track status lookup
  const handleCheckStatus = async (overrideQuery?: string) => {
    const q = (overrideQuery || trackQuery).trim();
    if (!q) return;

    setTrackLoading(true);
    setTrackError(null);
    setTrackResult(null);

    try {
      const res = await api.checkStatus(q);
      if (res.success && res.data) {
        setTrackResult(res.data);
      } else {
        setTrackError(res.message || `No application found for '${q}'`);
      }
    } catch (err: any) {
      setTrackError(err.message || 'Error tracking status');
    } finally {
      setTrackLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* AUTHENTICATION VIEW */}
      {!isAuthenticated ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-10">
          <div className="text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Student Portal Login</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
              Enter your official university email (<code className="text-blue-600 font-semibold">@student.hindustanuniv.ac.in</code>) to receive a verification OTP.
            </p>

            {/* User Guide Card for Students */}
            <div className="mt-4 p-4 bg-blue-50/70 border border-blue-200 rounded-2xl text-left space-y-2">
              <div className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-700" />
                <span>What Details Are Needed For Students:</span>
              </div>
              <ul className="text-[11px] text-blue-800 space-y-1 list-disc list-inside">
                <li><strong>University Register Number</strong> (e.g. 19251001) to fetch official academic records.</li>
                <li><strong>Official Student Email</strong> (@student.hindustanuniv.ac.in) for OTP login.</li>
                <li><strong>Final-Year Semester</strong> (UG Engineering VII/VIII, Non-Engg V/VI, PG III/IV).</li>
                <li><strong>Passport Convocation Photo</strong> (Strictly under 80 KB, white background, formal attire, JPEG).</li>
                <li><strong>Proof Documents</strong> (10th marksheet or TC if correcting name or parentage).</li>
              </ul>
            </div>

            {/* Form */}
            <div className="mt-5 space-y-4">
              {!otpSent ? (
                <div className="space-y-1.5 text-left">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. 25sp2160026 or username@student.hindustanuniv.ac.in"
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono bg-slate-50/50"
                    />
                    <button
                      onClick={handleSendOtp}
                      disabled={authLoading || !email}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {authLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send OTP'}
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-500 block pl-1">
                    Format required: Must end with <strong className="text-blue-700">@student.hindustanuniv.ac.in</strong> (typing just your Register Number auto-appends domain).
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      className="flex-1 px-4 py-3 text-center tracking-widest text-lg font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                    />
                    <button
                      onClick={handleVerifyOtp}
                      disabled={authLoading || otp.length !== 6}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                    >
                      {authLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify & Login'}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setOtpSent(false);
                      setOtp('');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 underline block"
                  >
                    ← Change Email
                  </button>
                </div>
              )}

              {authMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    authMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {authMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  )}
                  <span>{authMessage.text}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* AUTHENTICATED PORTAL VIEW */
        <div className="space-y-5">
          {/* Top Session Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Logged in Student
                </span>
                <span className="text-sm font-bold text-slate-900">{email}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsManualOpen(true)}
                className="px-3 py-1.5 text-xs text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" /> User Manual
              </button>
              <button
                onClick={() => setShowGuidelines(true)}
                className="px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors font-medium flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" /> Photo Guidelines
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors font-medium flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>

          {/* Navigation Tab Bar */}
          <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === 'upload'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>1. Verification & Photo Upload</span>
            </button>
            <button
              onClick={() => setActiveTab('track')}
              className={`py-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === 'track'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>2. Track Clearance Status</span>
            </button>
          </div>

          {/* TAB 1: VERIFICATION & PHOTO UPLOAD FLOW */}
          {activeTab === 'upload' && (
            <div className="space-y-5">
              {/* Visual Multi-Step & Document Progress Indicator */}
              <StepProgressIndicator
                currentStep={step}
                onStepClick={(targetStep) => setStep(targetStep)}
                requires10thProof={requires10thProof}
                has10thProof={Boolean(proof10thFile)}
                requiresTcProof={requiresTcProof}
                hasTcProof={Boolean(proofTcFile)}
                hasPhoto={Boolean(photoDataUrl)}
                photoSizeKb={photoSizeKb}
                isConfirmed={formData.confirmed}
              />

              {submitSuccess ? (
                /* Success Card */
                <div className="bg-white rounded-3xl border border-emerald-200 shadow-xs p-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Application Submitted for Review!</h3>
                    <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                      Your convocation profile details and passport photograph have been recorded and forwarded to your Department Class Teacher for verification.
                    </p>
                  </div>

                  <div className="inline-block bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left min-w-[280px]">
                    <div className="text-xs text-slate-500">Submission Tracking ID:</div>
                    <div className="text-lg font-mono font-bold text-blue-700">{submitSuccess.id}</div>
                    <div className="text-xs text-slate-500 mt-2">Current Pipeline Status:</div>
                    <div className="text-xs font-bold text-amber-700 bg-amber-100 inline-block px-2 py-0.5 rounded-full mt-0.5">
                      PENDING_TEACHER
                    </div>
                  </div>

                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      onClick={() => {
                        setTrackQuery(formData.registerNumber);
                        setActiveTab('track');
                        handleCheckStatus(formData.registerNumber);
                      }}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                    >
                      Track Live Progress
                    </button>
                    <button
                      onClick={() => {
                        setSubmitSuccess(null);
                        setStep(1);
                        setPhotoDataUrl(null);
                      }}
                      className="px-4 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Submit Another Record
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* STEP 1: REGISTER NUMBER LOOKUP */}
                  {step === 1 && (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-5">
                      <div>
                        <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider">
                          <span>Step 1 of 3</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                          Fetch Student Record from University Database
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Enter your university Register Number to retrieve your official academic profile from the <code className="text-blue-700">Student_data</code> directory.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="text"
                          value={lookupRegNo}
                          onChange={(e) => setLookupRegNo(e.target.value.toUpperCase())}
                          placeholder="ENTER REGISTER NUMBER (E.G. 19136010)"
                          className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono uppercase bg-slate-50/50"
                        />
                        <button
                          onClick={() => handleLookup()}
                          disabled={lookupLoading || !lookupRegNo}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 shrink-0"
                        >
                          {lookupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                          <span>Fetch Details</span>
                        </button>
                      </div>

                      {lookupError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{lookupError}</span>
                        </div>
                      )}

                      {/* Already Submitted Review State Card */}
                      {alreadySubmittedInfo && (
                        <div className="space-y-3">
                          <ReviewStateProgressIndicator
                            status={alreadySubmittedInfo.status}
                            teacherRemarks={alreadySubmittedInfo.teacherRemarks}
                            hodRemarks={alreadySubmittedInfo.hodRemarks}
                            studentName={alreadySubmittedInfo.name}
                            regNo={alreadySubmittedInfo.regNo}
                            submissionId={alreadySubmittedInfo.submissionId}
                          />
                          <div className="flex justify-end">
                            <button
                              onClick={() => {
                                setTrackQuery(alreadySubmittedInfo.regNo);
                                setActiveTab('track');
                                handleCheckStatus(alreadySubmittedInfo.regNo);
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                            >
                              <Clock className="w-3.5 h-3.5" /> View Full Tracking Details
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 2: SUMMARY & PROFILE VERIFICATION */}
                  {step === 2 && (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                        <div>
                          <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider">
                            <span>Step 2 of 3</span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 mt-0.5">Verify & Update Profile Records</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Verify your degree certificate particulars. Any changes to Name or Parentage will automatically require certificate proof documents.
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-200">
                          Year {originalData?.year} • {originalData?.branch}
                        </span>
                      </div>

                      {/* Fields Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Register Number (Locked)
                          </label>
                          <input
                            type="text"
                            value={formData.registerNumber}
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-mono text-xs font-bold"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Student Email (Locked to Session)
                          </label>
                          <input
                            type="email"
                            value={email}
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 text-xs"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-slate-700">
                              Student Name (10th Marksheet)
                            </label>
                            {isNameCorrected && (
                              <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.2 rounded">
                                Edited
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={formData.studentName}
                            onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium ${
                              isNameCorrected
                                ? 'border-amber-400 bg-amber-50/40 ring-1 ring-amber-300'
                                : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                            }`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-slate-700">
                              Father Name (TC Record)
                            </label>
                            {isFatherCorrected && (
                              <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.2 rounded">
                                Edited
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={formData.fatherName}
                            onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium ${
                              isFatherCorrected
                                ? 'border-amber-400 bg-amber-50/40 ring-1 ring-amber-300'
                                : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                          <select
                            value={formData.gender}
                            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                          >
                            <option value="MALE">MALE</option>
                            <option value="FEMALE">FEMALE</option>
                            <option value="OTHER">OTHER</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Date of Birth (TC)
                          </label>
                          <input
                            type="date"
                            value={formData.dob}
                            onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Nationality</label>
                          <input
                            type="text"
                            value={formData.nationality}
                            onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Department / Branch
                          </label>
                          <input
                            type="text"
                            value={formData.department}
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Specialization</label>
                          <input
                            type="text"
                            value={formData.specialization}
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 text-xs"
                          />
                        </div>

                        {/* Graduating Final-Year Semester Details */}
                        <div className="sm:col-span-2 md:col-span-3 p-4.5 bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/80 rounded-2xl border border-blue-200/90 shadow-2xs space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/60 pb-2.5">
                            <div>
                              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-blue-600" />
                                Graduating Final-Year Semester Details <span className="text-rose-500">*</span>
                              </label>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                {getStreamInfo(formData.programStream).explanation}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs self-start sm:self-auto">
                              <span className="text-[11px] font-semibold text-slate-500">Program Stream:</span>
                              <select
                                value={formData.programStream}
                                onChange={(e) => {
                                  const newStream = e.target.value as ProgramStream;
                                  const info = getStreamInfo(newStream);
                                  setFormData({
                                    ...formData,
                                    programStream: newStream,
                                    semester: info.defaultSem,
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg border border-blue-300 bg-white text-xs font-bold text-blue-900 shadow-2xs"
                              >
                                <option value="UG_ENGG">4-Year UG Engineering (Sem VII / VIII)</option>
                                <option value="UG_NON_ENGG">3-Year UG Non-Engg (Sem V / VI)</option>
                                <option value="PG_2YR">2-Year PG Programs (Sem III / IV)</option>
                              </select>
                            </div>
                          </div>

                          {/* Dynamic Semester Selection Chips */}
                          <div>
                            <span className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                              Select Your Current Final-Year Semester:
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 max-w-md">
                              {getStreamInfo(formData.programStream).semesters.map((sem) => {
                                const isSelected = formData.semester === sem;
                                return (
                                  <button
                                    key={sem}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, semester: sem })}
                                    className={`py-3 px-4 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                                      isSelected
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300'
                                        : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:bg-blue-50/40'
                                    }`}
                                  >
                                    <div className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
                                      {formData.programStream === 'UG_ENGG'
                                        ? 'Engineering Final Year'
                                        : formData.programStream === 'UG_NON_ENGG'
                                        ? 'UG Final Year'
                                        : 'PG Final Year'}
                                    </div>
                                    <div className="text-base font-extrabold mt-0.5">
                                      Semester {sem}
                                    </div>
                                    <div
                                      className={`text-[10px] mt-0.5 font-medium ${
                                        isSelected ? 'text-blue-100' : 'text-slate-400'
                                      }`}
                                    >
                                      {sem === getStreamInfo(formData.programStream).defaultSem
                                        ? '✓ Final Graduating Term'
                                        : 'Pre-Final Term'}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Section <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.section}
                            onChange={(e) => setFormData({ ...formData, section: e.target.value.toUpperCase() })}
                            placeholder="e.g. A, B, C"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs uppercase font-bold"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Shift / Batch Selection <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={formData.batch}
                            onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                          >
                            <option value="Batch A">Batch A (Shift I / Default)</option>
                            <option value="Batch B">Batch B (Shift II)</option>
                          </select>
                        </div>
                      </div>

                      {/* Info box for batch selection */}
                      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Multi-Shift Course Notice:</strong> Courses with two shifts (such as BCA) should select their respective shift (Batch A or Batch B). Single-shift programs should retain <strong>Batch A</strong>.
                        </div>
                      </div>

                      {/* Dynamic Proof Upload Section */}
                      {(requires10thProof || requiresTcProof) && (
                        <div className="p-5 bg-amber-50/60 border border-amber-300/80 rounded-2xl space-y-4">
                          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <span>Proof Documents Required for Correction</span>
                          </div>
                          <p className="text-xs text-amber-800">
                            Because one or more fields differ from the university enrollment database, official supporting proofs are mandatory:
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {requires10thProof && (
                              <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs space-y-2">
                                <label className="block text-xs font-bold text-slate-800">
                                  10th Marksheet Proof (Name Correction) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="file"
                                  accept="application/pdf,image/jpeg,image/jpg"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const res = await handleFileRead(file);
                                      setProof10thFile({ name: file.name, data: res.data, mime: res.mime });
                                    }
                                  }}
                                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200"
                                />
                                {proof10thFile && (
                                  <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> File attached: {proof10thFile.name}
                                  </div>
                                )}
                              </div>
                            )}

                            {requiresTcProof && (
                              <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs space-y-2">
                                <label className="block text-xs font-bold text-slate-800">
                                  Transfer Certificate (TC) Proof <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="file"
                                  accept="application/pdf,image/jpeg,image/jpg"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const res = await handleFileRead(file);
                                      setProofTcFile({ name: file.name, data: res.data, mime: res.mime });
                                    }
                                  }}
                                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200"
                                />
                                {proofTcFile && (
                                  <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> File attached: {proofTcFile.name}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Declaration Checkbox */}
                      <label className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/60 transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.confirmed}
                          onChange={(e) => setFormData({ ...formData, confirmed: e.target.checked })}
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span className="text-xs text-slate-700 font-medium leading-relaxed">
                          I hereby declare that all particulars entered above are accurate and match my official 10th Marksheet and Transfer Certificate records. I acknowledge that submitting false documents will lead to cancellation of clearance.
                        </span>
                      </label>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" /> Back to Search
                        </button>
                        <button
                          type="button"
                          onClick={handleProceedToPhoto}
                          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <span>Confirm Details & Proceed to Photo</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: PASSPORT PHOTOGRAPH UPLOAD */}
                  {step === 3 && (
                    <form
                      onSubmit={handleFinalSubmit}
                      className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                        <div>
                          <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider">
                            <span>Step 3 of 3</span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                            Upload Formal Passport Photograph
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Strict formal studio requirements apply. Max file size: <strong>80 KB</strong> in JPEG format.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowGuidelines(true)}
                          className="px-3 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors font-medium flex items-center gap-1.5"
                        >
                          <Info className="w-3.5 h-3.5" /> Full Guidelines Checklist
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                        {/* File Upload Control */}
                        <div className="md:col-span-2 space-y-4">
                          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-blue-500 transition-colors bg-slate-50/50">
                            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                            <label className="block text-xs font-semibold text-slate-800 mb-1 cursor-pointer">
                              <span className="text-blue-600 hover:underline">Click to upload photo</span> or drag & drop
                            </label>
                            <span className="text-[11px] text-slate-500 block mb-3">
                              JPEG format only • Strictly &lt; 80 KB • 35mm x 40mm
                            </span>
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg"
                              onChange={handlePhotoSelect}
                              className="hidden"
                              id="photoInputHidden"
                            />
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <label
                                htmlFor="photoInputHidden"
                                className="inline-block px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer shadow-2xs"
                              >
                                Choose Photo File
                              </label>
                            </div>
                          </div>

                          {/* Photo size & error notices */}
                          {photoSizeKb > 0 && (
                            <div className="flex items-center justify-between text-xs px-2">
                              <span className="text-slate-600">
                                Selected size:{' '}
                                <strong className={photoSizeKb > 80 ? 'text-rose-600' : 'text-emerald-700'}>
                                  {photoSizeKb} KB
                                </strong>
                              </span>
                              {photoSizeKb <= 80 && (
                                <span className="text-emerald-700 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Size meets 80 KB limit
                                </span>
                              )}
                            </div>
                          )}

                          {photoError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                                <span>{photoError}</span>
                              </div>
                              {photoDataUrl && photoSizeKb > 80 && (
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={handleAutoCompressPhoto}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" /> One-Click Auto-Compress to 75 KB
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Live Photo Preview Box */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-2">
                          <span className="text-xs font-bold text-slate-700 block">Degree Photo Preview</span>
                          <div className="w-[140px] h-[160px] mx-auto bg-white border-2 border-slate-300 rounded-lg overflow-hidden flex items-center justify-center shadow-xs relative">
                            {photoDataUrl ? (
                              <img
                                src={photoDataUrl}
                                alt="Student Preview"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-center p-3 text-slate-400">
                                <Camera className="w-8 h-8 mx-auto mb-1 opacity-40" />
                                <span className="text-[10px] block">No Photo Selected</span>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Aspect Ratio 35mm x 40mm
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" /> Back to Details
                        </button>
                        <button
                          type="submit"
                          disabled={submitLoading || !photoDataUrl || photoSizeKb > 80}
                          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
                        >
                          {submitLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" /> Submitting to Teacher Review...
                            </>
                          ) : (
                            <>
                              <span>Final Submit Application</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: TRACK SUBMISSION STATUS */}
          {activeTab === 'track' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Track Convocation Clearance Status</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search by your Register Number or Student Email to check your real-time approval stage across Teacher and HOD clearance.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={trackQuery}
                  onChange={(e) => setTrackQuery(e.target.value.toUpperCase())}
                  placeholder="ENTER REGISTER NUMBER OR EMAIL"
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono uppercase bg-slate-50/50"
                />
                <button
                  onClick={() => handleCheckStatus()}
                  disabled={trackLoading || !trackQuery}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 shrink-0"
                >
                  {trackLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Check Status</span>
                </button>
              </div>

              {trackError && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 text-center">
                  {trackError}
                </div>
              )}

              {/* Status Result with Visual Progress Indicator */}
              {trackResult && (
                <div className="space-y-6">
                  {/* Visual Review Pipeline Stepper */}
                  <ReviewStateProgressIndicator
                    status={trackResult.status}
                    teacherRemarks={trackResult.teacherRemarks}
                    hodRemarks={trackResult.hodRemarks}
                    deanRemarks={trackResult.deanRemarks}
                    studentName={trackResult.name}
                    regNo={trackResult.regNo}
                    submissionId={trackResult.submissionId}
                  />

                  {/* Student & Department Particulars Card */}
                  <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 text-xs space-y-3">
                    <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                      Application Particulars
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-slate-600">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Department:</span>
                        <span className="font-medium text-slate-800">{trackResult.departmentBranch || trackResult.dept}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Specialization:</span>
                        <span className="font-medium text-slate-800">{trackResult.specialization || 'General'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Semester:</span>
                        <span className="font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded text-[11px] inline-block font-mono">
                          Sem {trackResult.semester || 'VIII'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Section & Shift:</span>
                        <span className="font-medium text-slate-800">Sec {trackResult.section} • {trackResult.batch}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Document Notes:</span>
                        <span className="font-medium text-slate-800">{trackResult.valStatus || trackResult.validationNotes || 'Verified without edits'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reviewer Remarks & Rejection notice */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                      Reviewer Feedback & Remarks
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-400 block text-[10px] font-semibold">Teacher Remarks:</span>
                        <p className="text-slate-700 mt-1 italic">
                          {trackResult.teacherRemarks || 'No remarks recorded yet.'}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-400 block text-[10px] font-semibold">HOD Remarks:</span>
                        <p className="text-slate-700 mt-1 italic">
                          {trackResult.hodRemarks || 'No remarks recorded yet.'}
                        </p>
                      </div>
                    </div>

                    {trackResult.status.includes('REJECTED') && (
                      <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
                        <div className="text-xs text-rose-800">
                          <strong className="block text-rose-900 mb-0.5">Action Required:</strong>
                          Your application was rejected. Please review the reviewer remarks above, rectify the issue, and resubmit your photo.
                        </div>
                        <button
                          onClick={() => {
                            setLookupRegNo(trackResult.regNo);
                            setActiveTab('upload');
                            setStep(1);
                            handleLookup(trackResult.regNo);
                          }}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors shrink-0"
                        >
                          Re-Upload / Fix Application
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Guidelines Modal */}
      <PhotoGuidelineModal isOpen={showGuidelines} onClose={() => setShowGuidelines(false)} />

      {/* User Manual Modal */}
      <UserManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} defaultRole="student" />
    </div>
  );
};
