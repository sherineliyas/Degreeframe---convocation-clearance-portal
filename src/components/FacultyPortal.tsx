import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { storage } from '../services/store';
import { FacultyRecord, SubmissionRecord } from '../types';
import { UserManualModal } from './UserManualModal';
import { formatDriveImageUrl, extractDriveFileId, DEFAULT_AVATAR_SVG } from '../utils/imageUtils';
import {
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserPlus,
  RefreshCw,
  LogOut,
  FileText,
  ExternalLink,
  Eye,
  SlidersHorizontal,
  Mail,
  Camera,
  Check,
  X,
  BookOpen,
} from 'lucide-react';

export const FacultyPortal: React.FC = () => {
  // Auth state
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [currentFaculty, setCurrentFaculty] = useState<FacultyRecord | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);

  // Applications list
  const [applications, setApplications] = useState<SubmissionRecord[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [remarksState, setRemarksState] = useState<Record<string, string>>({});
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Inspector modal for photo & proof
  const [previewMedia, setPreviewMedia] = useState<{
    type: 'photo' | 'proof10th' | 'proofTc';
    student: SubmissionRecord;
  } | null>(null);

  // HOD Add Teacher Modal
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [newTeacherData, setNewTeacherData] = useState({
    email: '',
    name: '',
    specialization: 'ALL',
    semester: 'VIII',
    batch: 'Batch A',
    section: 'A',
  });
  const [addTeacherLoading, setAddTeacherLoading] = useState(false);
  const [addTeacherMsg, setAddTeacherMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // 1. Send OTP
  const handleSendOtp = async () => {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      let targetEmail = email.toLowerCase().trim();
      if (!targetEmail) {
        setAuthMessage({ text: 'Please enter your institutional email.', type: 'error' });
        setAuthLoading(false);
        return;
      }
      if (!targetEmail.includes('@')) {
        targetEmail = targetEmail + '@hindustanuniv.ac.in';
        setEmail(targetEmail);
      }
      if (!targetEmail.endsWith('@hindustanuniv.ac.in')) {
        setAuthMessage({ text: 'Official faculty email must end in @hindustanuniv.ac.in', type: 'error' });
        setAuthLoading(false);
        return;
      }

      const res = await api.sendOtp(targetEmail, 'faculty');
      if (res.success) {
        setOtpSent(true);
        setAuthMessage({ text: res.message || 'OTP sent to official faculty email', type: 'success' });
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
      let targetEmail = email.toLowerCase().trim();
      if (!targetEmail.includes('@')) {
        targetEmail = targetEmail + '@hindustanuniv.ac.in';
        setEmail(targetEmail);
      }
      const res = await api.verifyOtp(targetEmail, otp, 'faculty');
      if (res.success && res.faculty) {
        setCurrentFaculty(res.faculty);
        setAuthMessage(null);
        loadApplications(res.faculty.email);
      } else {
        setAuthMessage({ text: res.message || 'Authentication failed', type: 'error' });
      }
    } catch (e: any) {
      setAuthMessage({ text: e.message || 'Error verifying OTP', type: 'error' });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentFaculty(null);
    setOtpSent(false);
    setOtp('');
    setApplications([]);
  };

  // Assigned Class Teachers for HOD
  const [assignedTeachers, setAssignedTeachers] = useState<FacultyRecord[]>([]);
  const [editingTeacherEmail, setEditingTeacherEmail] = useState<string | null>(null);

  const handleOpenAddTeacherModal = () => {
    setEditingTeacherEmail(null);
    setNewTeacherData({
      email: '',
      name: '',
      specialization: 'ALL',
      semester: 'VIII',
      batch: 'Batch A',
      section: 'A',
    });
    setAddTeacherMsg(null);
    setIsAddTeacherOpen(true);
  };

  const handleEditTeacherModal = (teacher: FacultyRecord) => {
    setEditingTeacherEmail(teacher.email);
    setNewTeacherData({
      email: teacher.email || '',
      name: teacher.name || '',
      specialization: teacher.specialization || 'ALL',
      semester: teacher.semester || 'VIII',
      batch: teacher.batch || 'Batch A',
      section: teacher.section || 'A',
    });
    setAddTeacherMsg(null);
    setIsAddTeacherOpen(true);
  };

  const handleDeleteTeacher = async (teacherEmail: string) => {
    if (!currentFaculty || currentFaculty.role !== 'HOD') return;
    if (!window.confirm(`Are you sure you want to remove Class Teacher ${teacherEmail}?`)) return;

    try {
      const res = await api.deleteClassTeacher(currentFaculty.email, teacherEmail);
      if (res.success) {
        setActionSuccessMsg(res.message || `Class Teacher ${teacherEmail} removed successfully.`);
        setTimeout(() => setActionSuccessMsg(null), 4000);
        loadApplications();
      } else {
        alert(res.message || 'Failed to remove class teacher.');
      }
    } catch (e: any) {
      alert(e.message || 'Error removing class teacher.');
    }
  };

  // 3. Load Pending Applications
  const loadApplications = async (facEmail?: string) => {
    const targetEmail = facEmail || currentFaculty?.email;
    if (!targetEmail) return;

    setLoadingApps(true);
    try {
      const res = await api.getPendingApplications(targetEmail);
      if (res.success && Array.isArray(res.data)) {
        setApplications(res.data);
      }
      if (res.assignedTeachers) {
        setAssignedTeachers(res.assignedTeachers);
      } else {
        const targetDept = (res.faculty?.department || currentFaculty?.department || '').toUpperCase();
        if (targetDept) {
          const localTeachers = storage.getFaculty().filter(
            (f) => f.role === 'TEACHER' && f.department.toUpperCase() === targetDept
          );
          setAssignedTeachers(localTeachers);
        }
      }
    } catch (e) {
      console.error('Error fetching applications:', e);
    } finally {
      setLoadingApps(false);
    }
  };

  // 4. Submit Decision (Approve / Reject)
  const handleDecision = async (sub: SubmissionRecord, decision: 'APPROVE' | 'REJECT') => {
    if (!currentFaculty) return;

    const remarks = (remarksState[sub.submissionId] || '').trim();
    if (decision === 'REJECT' && !remarks) {
      alert('Review remarks are mandatory when rejecting an application to explain reasons to the student.');
      return;
    }

    try {
      const res = await api.processFacultyAction({
        submissionId: sub.submissionId,
        decision,
        remarks: remarks || (decision === 'APPROVE' ? 'Approved as per convocation standards.' : ''),
        role: currentFaculty.role,
        facultyEmail: currentFaculty.email,
      });

      if (res.success) {
        setActionSuccessMsg(res.message || `Application ${decision.toLowerCase()}d successfully.`);
        setTimeout(() => setActionSuccessMsg(null), 4000);
        // Clear remark
        setRemarksState({ ...remarksState, [sub.submissionId]: '' });
        loadApplications();
      } else {
        alert(res.message || 'Action failed');
      }
    } catch (e: any) {
      alert(e.message || 'Error updating status');
    }
  };

  // 5. HOD Add / Update Class Teacher
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFaculty || currentFaculty.role !== 'HOD') return;

    if (!newTeacherData.email.endsWith('@hindustanuniv.ac.in')) {
      setAddTeacherMsg({ text: 'Official email must end in @hindustanuniv.ac.in', type: 'error' });
      return;
    }

    setAddTeacherLoading(true);
    setAddTeacherMsg(null);

    try {
      let res;
      if (editingTeacherEmail) {
        res = await api.updateClassTeacher({
          hodEmail: currentFaculty.email,
          oldEmail: editingTeacherEmail,
          newEmail: newTeacherData.email,
          name: newTeacherData.name,
          department: currentFaculty.department,
          specialization: newTeacherData.specialization,
          semester: newTeacherData.semester,
          batch: newTeacherData.batch,
          section: newTeacherData.section,
        });
      } else {
        res = await api.addClassTeacher({
          hodEmail: currentFaculty.email,
          teacherEmail: newTeacherData.email,
          teacherName: newTeacherData.name,
          department: currentFaculty.department,
          specialization: newTeacherData.specialization,
          semester: newTeacherData.semester,
          batch: newTeacherData.batch,
          section: newTeacherData.section,
        });
      }

      if (res.success) {
        setAddTeacherMsg({
          text: res.message || (editingTeacherEmail ? 'Class Teacher updated successfully!' : 'Class Teacher assigned successfully!'),
          type: 'success',
        });
        setEditingTeacherEmail(null);
        setNewTeacherData({
          email: '',
          name: '',
          specialization: 'ALL',
          semester: 'VIII',
          batch: 'Batch A',
          section: 'A',
        });
        await loadApplications();
        setTimeout(() => {
          setIsAddTeacherOpen(false);
          setAddTeacherMsg(null);
        }, 1200);
      } else {
        setAddTeacherMsg({ text: res.message || 'Failed to save teacher', type: 'error' });
      }
    } catch (e: any) {
      setAddTeacherMsg({ text: e.message || 'Error saving teacher', type: 'error' });
    } finally {
      setAddTeacherLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* FACULTY AUTHENTICATION VIEW */}
      {!currentFaculty ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-10">
          <div className="text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Faculty Approval Portal</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
              Restricted to authorized Class Teachers and Heads of Department. Sign in using your official institutional email (<code className="text-emerald-700 font-semibold">@hindustanuniv.ac.in</code>).
            </p>

            {/* User Guide Card for Faculty & HOD */}
            <div className="mt-4 p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-left space-y-2">
              <div className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-700" />
                <span>What Details Are Needed For Faculty & HOD:</span>
              </div>
              <ul className="text-[11px] text-emerald-800 space-y-1 list-disc list-inside">
                <li><strong>Official Faculty Email</strong> (@hindustanuniv.ac.in) for secure Email OTP login.</li>
                <li><strong>Assigned Department & Section</strong> to review student passport photos and marksheet proofs.</li>
                <li><strong>Review Decision</strong>: Click Approve to forward/clear or Reject with mandatory remarks.</li>
                <li><strong>HOD Authorization</strong>: Assign departmental class teachers and manage verification scope.</li>
              </ul>
            </div>

            {/* Login form */}
            <div className="mt-5 space-y-4">
              {!otpSent ? (
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="faculty@hindustanuniv.ac.in"
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-slate-50/50"
                  />
                  <button
                    onClick={handleSendOtp}
                    disabled={authLoading || !email}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    {authLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send OTP'}
                  </button>
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
                      {authLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify & Sign In'}
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
        /* AUTHENTICATED FACULTY DASHBOARD */
        <div className="space-y-5">
          {/* Faculty Profile Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 text-emerald-400 flex items-center justify-center font-bold text-lg border border-white/10">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{currentFaculty.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        currentFaculty.role === 'HOD'
                          ? 'bg-amber-400 text-amber-950'
                          : 'bg-emerald-500 text-white'
                      }`}
                    >
                      {currentFaculty.role}
                    </span>
                  </div>
                  <span className="text-xs text-slate-300 font-mono">{currentFaculty.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsManualOpen(true)}
                  className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-xl border border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Faculty Manual
                </button>
                {currentFaculty.role === 'HOD' && (
                  <button
                    onClick={handleOpenAddTeacherModal}
                    className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Assign Class Teacher
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/15 transition-colors flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            </div>

            {/* Scope Details */}
            <div className="pt-2 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Department</span>
                <span className="font-semibold text-white">{currentFaculty.department}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Semester</span>
                <span className="font-bold text-amber-300">{currentFaculty.semester ? `Sem ${currentFaculty.semester}` : 'ALL'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Specialization</span>
                <span className="font-medium text-white">{currentFaculty.specialization || 'ALL'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Shift / Batch</span>
                <span className="font-medium text-white">{currentFaculty.batch || 'ALL'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Section</span>
                <span className="font-bold text-emerald-400">{currentFaculty.section || 'ALL'}</span>
              </div>
            </div>
          </div>

          {/* Action Success Alert Feedback */}
          {actionSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{actionSuccessMsg}</span>
              </div>
              <button
                onClick={() => setActionSuccessMsg(null)}
                className="text-emerald-700 hover:text-emerald-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* HOD Appointed Class Teachers Directory */}
          {currentFaculty.role === 'HOD' && (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UserPlus className="w-4.5 h-4.5 text-amber-600" />
                    Appointed Class Teachers Directory ({assignedTeachers.length})
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Class teachers appointed for section-level student verification in {currentFaculty.department}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddTeacherModal}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer self-start"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Assign New Teacher
                </button>
              </div>

              {assignedTeachers.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                  No class teachers currently assigned for {currentFaculty.department}. Click "Assign New Teacher" above.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/60">
                        <th className="py-2.5 px-3 font-semibold">Teacher Name</th>
                        <th className="py-2.5 px-3 font-semibold">Official Email</th>
                        <th className="py-2.5 px-3 font-semibold">Sem & Sec</th>
                        <th className="py-2.5 px-3 font-semibold">Shift / Batch</th>
                        <th className="py-2.5 px-3 font-semibold">Specialization</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assignedTeachers.map((t) => (
                        <tr key={t.email} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{t.name}</td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-700 text-[11px]">{t.email}</td>
                          <td className="py-2.5 px-3 font-semibold text-blue-700">
                            Sem {t.semester || 'VIII'} • Sec {t.section || 'A'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{t.batch || 'Batch A'}</td>
                          <td className="py-2.5 px-3 text-slate-600">{t.specialization || 'ALL'}</td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEditTeacherModal(t)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                              >
                                Edit Details
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTeacher(t.email)}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold cursor-pointer transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Applications Section Header */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-900">
                {currentFaculty.role === 'TEACHER'
                  ? 'Pending Class Teacher Reviews (Stage 1)'
                  : 'Pending HOD Approvals (Stage 2)'}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentFaculty.role === 'TEACHER'
                  ? `Filtered strictly to ${currentFaculty.department} • Sec ${currentFaculty.section} • ${currentFaculty.batch}`
                  : `Filtered to all forwarded submissions in ${currentFaculty.department}`}
              </p>
            </div>
            <button
              onClick={() => loadApplications()}
              disabled={loadingApps}
              className="px-3 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors font-medium flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingApps ? 'animate-spin' : ''}`} />
              <span>Refresh List</span>
            </button>
          </div>

          {/* Applications List */}
          {loadingApps ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              <span>Loading applications...</span>
            </div>
          ) : applications.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <h5 className="font-bold text-slate-800 text-sm">All caught up!</h5>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No pending applications currently require your review under this assigned scope.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((app) => (
                <div
                  key={app.submissionId}
                  className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-5 hover:border-slate-300 transition-all space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    {/* Photo with inspect trigger */}
                    <div className="shrink-0 text-center">
                      <div className="relative group w-[105px] h-[125px] rounded-xl overflow-hidden border border-slate-300 bg-slate-100 shadow-2xs mx-auto">
                        <img
                          src={formatDriveImageUrl(app.finalDriveUrl)}
                          alt={app.studentName}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e: any) => {
                            e.target.onerror = null;
                            const fid = extractDriveFileId(app.finalDriveUrl);
                            if (fid && !e.target.src.includes('lh3.googleusercontent.com')) {
                              e.target.src = `https://lh3.googleusercontent.com/d/${fid}=s800`;
                            } else {
                              e.target.src = DEFAULT_AVATAR_SVG;
                            }
                          }}
                        />
                        <button
                          onClick={() => setPreviewMedia({ type: 'photo', student: app })}
                          className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-[11px] font-semibold"
                        >
                          <Eye className="w-4 h-4" /> Inspect
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                        {app.photoUpload}
                      </span>
                    </div>

                    {/* Student particulars */}
                    <div className="flex-1 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h5 className="font-bold text-sm text-slate-900">{app.studentName}</h5>
                          <span className="font-mono text-xs font-semibold text-blue-700">
                            {app.registerNumber}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          {app.approvalStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Father Name:</span>
                          <span className="font-medium text-slate-800">{app.fatherName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">DOB / Gender:</span>
                          <span className="font-mono">{app.dob} ({app.gender})</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Department:</span>
                          <span>{app.departmentBranch}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Semester:</span>
                          <span className="font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded font-mono">
                            Sem {app.semester || 'VIII'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Section / Shift:</span>
                          <span className="font-bold text-slate-900">Sec {app.section} • {app.batch}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Specialization:</span>
                          <span>{app.specialization}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Ref ID:</span>
                          <span className="font-mono text-slate-700">{app.submissionId}</span>
                        </div>
                      </div>

                      {/* Validation / Correction Notes Tag */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Notes:
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                          {app.validationNotes}
                        </span>
                      </div>

                      {/* Previous Teacher remarks if HOD */}
                      {currentFaculty.role === 'HOD' && app.teacherRemarks && (
                        <div className="p-2 bg-emerald-50/70 border border-emerald-200 rounded-lg text-[11px] text-emerald-900">
                          <strong>Teacher Remarks:</strong> <em>"{app.teacherRemarks}"</em>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Review Decision Row */}
                  <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="text"
                      placeholder="Enter review remarks (mandatory for rejections)..."
                      value={remarksState[app.submissionId] || ''}
                      onChange={(e) =>
                        setRemarksState({ ...remarksState, [app.submissionId]: e.target.value })
                      }
                      className="flex-1 w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <button
                        onClick={() => handleDecision(app, 'APPROVE')}
                        className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{currentFaculty.role === 'TEACHER' ? 'Forward to HOD' : 'Final Approve'}</span>
                      </button>

                      <button
                        onClick={() => handleDecision(app, 'REJECT')}
                        className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* INSPECTION MODAL */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">
                  {previewMedia.type === 'photo'
                    ? 'Passport Photograph Verification'
                    : previewMedia.type === 'proof10th'
                    ? '10th Marksheet Proof Document'
                    : 'Transfer Certificate (TC) Document'}
                </h4>
                <p className="text-xs text-slate-400">
                  {previewMedia.student.studentName} ({previewMedia.student.registerNumber})
                </p>
              </div>
              <button
                onClick={() => setPreviewMedia(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 text-center bg-slate-50 space-y-4">
              {previewMedia.type === 'photo' ? (
                <div>
                  <div className="w-[200px] h-[240px] mx-auto bg-white border-2 border-slate-300 rounded-lg overflow-hidden shadow-md">
                    <img
                      src={formatDriveImageUrl(previewMedia.student.finalDriveUrl)}
                      alt="Student"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e: any) => {
                        e.target.onerror = null;
                        const fid = extractDriveFileId(previewMedia.student.finalDriveUrl);
                        if (fid && !e.target.src.includes('lh3.googleusercontent.com')) {
                          e.target.src = `https://lh3.googleusercontent.com/d/${fid}=s800`;
                        } else {
                          e.target.src = DEFAULT_AVATAR_SVG;
                        }
                      }}
                    />
                  </div>
                  <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200 text-left text-xs space-y-1.5">
                    <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                      Verification Checklist:
                    </span>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                      <div>✓ Plain light background</div>
                      <div>✓ Formal studio attire</div>
                      <div>✓ Face centered, eyes open</div>
                      <div>✓ File &lt; 80 KB in JPEG</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-full h-64 bg-white border border-slate-300 rounded-xl flex items-center justify-center overflow-hidden">
                    <img
                      src={
                        previewMedia.type === 'proof10th'
                          ? previewMedia.student.proof10thUrl
                          : previewMedia.student.proofTcUrl
                      }
                      alt="Proof"
                      className="max-h-full max-w-full object-contain"
                      onError={(e: any) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <div className="p-4 text-xs text-slate-500">
                      <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                      <span>Document Attached by Student</span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 block">
                    Verify that student name and particulars strictly match the revised fields.
                  </span>
                </div>
              )}
            </div>

            <div className="bg-slate-100 p-3 flex justify-end">
              <button
                onClick={() => setPreviewMedia(null)}
                className="px-4 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HOD ASSIGN CLASS TEACHER MODAL */}
      {isAddTeacherOpen && currentFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-amber-400 text-amber-950 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                <h4 className="font-bold text-sm">
                  {editingTeacherEmail ? 'Edit Class Teacher Details' : 'Assign Class Teacher'}
                </h4>
              </div>
              <button
                onClick={() => setIsAddTeacherOpen(false)}
                className="text-amber-900 hover:text-black p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTeacher} className="p-5 space-y-3 text-xs">
              {addTeacherMsg && (
                <div
                  className={`p-2.5 rounded-xl ${
                    addTeacherMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {addTeacherMsg.text}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Teacher Official Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={newTeacherData.email}
                  onChange={(e) => setNewTeacherData({ ...newTeacherData, email: e.target.value })}
                  placeholder="teacher@hindustanuniv.ac.in"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Teacher Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTeacherData.name}
                  onChange={(e) => setNewTeacherData({ ...newTeacherData, name: e.target.value })}
                  placeholder="Dr. Jane Doe"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Department</label>
                  <input
                    type="text"
                    value={currentFaculty.department}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Specialization</label>
                  <input
                    type="text"
                    value={newTeacherData.specialization}
                    onChange={(e) =>
                      setNewTeacherData({ ...newTeacherData, specialization: e.target.value })
                    }
                    placeholder="e.g. ALL or AI"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Semester <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newTeacherData.semester}
                    onChange={(e) => setNewTeacherData({ ...newTeacherData, semester: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-semibold text-blue-900"
                  >
                    <option value="VIII">Sem VIII (UG 4-Yr)</option>
                    <option value="VII">Sem VII (UG 4-Yr)</option>
                    <option value="VI">Sem VI (UG 3-Yr)</option>
                    <option value="V">Sem V (UG 3-Yr)</option>
                    <option value="IV">Sem IV (PG 2-Yr)</option>
                    <option value="III">Sem III (PG 2-Yr)</option>
                    <option value="ALL">ALL Semesters</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Shift / Batch</label>
                  <select
                    value={newTeacherData.batch}
                    onChange={(e) => setNewTeacherData({ ...newTeacherData, batch: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Batch A">Batch A</option>
                    <option value="Batch B">Batch B</option>
                    <option value="ALL">ALL</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Section(s) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTeacherData.section}
                    onChange={(e) =>
                      setNewTeacherData({ ...newTeacherData, section: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. A, B or ALL"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl uppercase font-bold"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTeacherOpen(false)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addTeacherLoading}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {addTeacherLoading
                    ? 'Saving...'
                    : editingTeacherEmail
                    ? 'Save Teacher Details'
                    : 'Save Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* User Manual Modal */}
      <UserManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} defaultRole="faculty" />
    </div>
  );
};
