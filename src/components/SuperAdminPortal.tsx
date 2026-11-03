import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Users,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building,
  X,
  User,
  Sparkles,
  LogOut as LogOutIcon,
  Lock,
  KeyRound,
  BookOpen
} from 'lucide-react';
import { api } from '../services/api';
import { UserManualModal } from './UserManualModal';
import { CoeSettings, CoeOverviewStats } from '../types';

interface SuperAdminInfo {
  username: string;
  name: string;
  role: 'SUPER_ADMIN';
  streamScope: 'ALL';
  isDefaultPassword?: boolean;
}

interface CoeUserAccount {
  username?: string;
  email: string;
  name: string;
  role: string;
  streamScope: string;
  isDefaultPassword?: boolean;
  otpEnabled?: boolean;
  addedAt?: string;
}

export const SuperAdminPortal: React.FC = () => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('superadmin_session_auth') === 'true';
  });
  const [adminUsername, setAdminUsername] = useState<string>(() => {
    return sessionStorage.getItem('superadmin_session_username') || 'superadmin';
  });
  const [passwordInput, setPasswordInput] = useState<string>('Admin@123');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [authSuccess, setAuthSuccess] = useState<string>('');

  // Super Admin Data State
  const [activeTab, setActiveTab] = useState<'acoe_management' | 'system_config' | 'system_stats'>('acoe_management');
  const [coeUsersList, setCoeUsersList] = useState<CoeUserAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isManualOpen, setIsManualOpen] = useState<boolean>(false);

  // Config Form State
  const [driveUrlInput, setDriveUrlInput] = useState('');
  const [sheetUrlInput, setSheetUrlInput] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // ACOE Management State
  const [acoeForm, setAcoeForm] = useState({ email: '', name: '', otpEnabled: true });
  const [isAddingAcoe, setIsAddingAcoe] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [settings, setSettings] = useState<CoeSettings | null>(null);
  const [stats, setStats] = useState<CoeOverviewStats>({
    pendingTeacher: 0,
    pendingHod: 0,
    rejected: 0,
    totalTeachers: 0,
    totalStudents: 0,
    totalSubmissions: 0,
    approved: 0,
    totalHods: 0,
    streamScope: 'ALL'
  });

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const overviewRes = await api.getCoeOverview('ALL');
      if (overviewRes.success) {
        if (overviewRes.settings) {
          setSettings(overviewRes.settings);
          setDriveUrlInput(overviewRes.settings.driveFolderUrl);
          setSheetUrlInput(overviewRes.settings.spreadsheetUrl);
          setBatchInput(overviewRes.settings.convocationBatch);
          setYearInput(overviewRes.settings.academicYear);
        }
        if (overviewRes.stats) {
          setStats(overviewRes.stats);
        }
      }

      const usersRes = await api.getCoeUsers();
      if (usersRes.success && usersRes.users) {
        setCoeUsersList(usersRes.users);
      }
    } catch (e: any) {
      console.warn('Error loading Super Admin data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!adminUsername.trim()) {
      setAuthError('Please enter Chief Super Admin username.');
      return;
    }

    setIsSubmittingAuth(true);
    try {
      const res = await api.coeLogin(adminUsername, passwordInput);
      if (res.success && res.coeUser) {
        setIsAuthenticated(true);
        sessionStorage.setItem('superadmin_session_auth', 'true');
        sessionStorage.setItem('superadmin_session_username', adminUsername);
        setAuthSuccess('Super Admin authenticated successfully.');
      } else {
        setAuthError(res.message || 'Invalid username or password.');
      }
    } catch {
      setAuthError('Connection error attempting Super Admin login.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('superadmin_session_auth');
    sessionStorage.removeItem('superadmin_session_username');
    setIsAuthenticated(false);
  };

  const handleAddAcoeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingAcoe(true);
    setNotification(null);
    try {
        const res = await api.addAcoeUser({ email: acoeForm.email, name: acoeForm.name, otpEnabled: acoeForm.otpEnabled });
        if (res.success) {
            setNotification({ type: 'success', message: 'ACOE User added successfully.' });
            setAcoeForm({ email: '', name: '', otpEnabled: true });
            loadData();
        } else {
            setNotification({ type: 'error', message: res.message || 'Failed to add ACOE user.' });
        }
    } catch (e: any) {
        setNotification({ type: 'error', message: 'Error adding ACOE user.' });
    } finally {
        setIsAddingAcoe(false);
    }
  };

  const handleToggleOtp = async (email: string, currentStatus: boolean) => {
    setNotification(null);
    try {
        const res = await api.toggleAcoeOtp(email, !currentStatus);
        if (res.success) {
            setNotification({ type: 'success', message: 'OTP status updated.' });
            loadData();
        } else {
            setNotification({ type: 'error', message: res.message || 'Failed to update OTP status.' });
        }
    } catch (e: any) {
        setNotification({ type: 'error', message: 'Error updating OTP status.' });
    }
  };

  const handleEditAcoeEmail = async (user: CoeUserAccount) => {
      console.log('Edit email for', user.email);
      setNotification({ type: 'error', message: 'Feature not yet implemented.' });
  }

  const handleDeleteAcoe = async (email: string) => {
    setNotification(null);
    try {
        const res = await api.deleteAcoeUser(email);
        if (res.success) {
            setNotification({ type: 'success', message: 'ACOE user removed.' });
            loadData();
        } else {
            setNotification({ type: 'error', message: res.message || 'Failed to remove ACOE user.' });
        }
    } catch (e: any) {
        setNotification({ type: 'error', message: 'Error removing ACOE user.' });
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setNotification(null);
    try {
      const res = await api.updateCoeConfig({
        driveFolderUrl: driveUrlInput,
        spreadsheetUrl: sheetUrlInput,
        convocationBatch: batchInput,
        academicYear: yearInput,
      });
      if (res.success) {
        setNotification({ type: 'success', message: 'System configuration and governance parameters updated successfully.' });
        loadData();
      } else {
        setNotification({ type: 'error', message: res.message || 'Failed to update configuration.' });
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: 'Error updating system configuration.' });
    } finally {
      setIsSavingConfig(false);
    }
  };


  // -------------------------------------------------------------
  // RENDER 1: AUTHENTICATION SCREEN (USERNAME & PASSWORD ONLY)
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-8">
        <div className="bg-white rounded-3xl border border-amber-200 shadow-xl overflow-hidden p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 via-purple-700 to-indigo-800 text-white flex items-center justify-center mx-auto shadow-md mb-3">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Chief COE Super Admin
            </h2>
            <p className="text-xs text-amber-700 font-medium mt-1 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 inline-block">
              Dedicated Governance Control Module
            </p>

            {/* User Guide Card for Super Admin */}
            <div className="mt-4 p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-left space-y-2">
              <div className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-amber-700" />
                <span>What Details Are Needed For Chief Super Admin:</span>
              </div>
              <ul className="text-[11px] text-amber-800 space-y-1 list-disc list-inside">
                <li><strong>Super Admin Username</strong> (<code className="font-mono">superadmin</code>) and Password (<code className="font-mono">Admin@123</code>).</li>
                <li><strong>ACOE Officer Management</strong>: Add official ACOE emails and toggle Email OTP dispatch per ACOE user.</li>
                <li><strong>System Configuration</strong>: Manage Google Drive and Google Sheets master URLs dynamically.</li>
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



          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Super Admin Username *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="superadmin"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Super Admin Password *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Admin@123"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingAuth}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-purple-700 hover:from-amber-700 hover:to-purple-800 text-white text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isSubmittingAuth ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Authenticating Super Admin...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Sign In to Super Admin Hub
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400">
              Chief COE Super Admin Module • HITS Academic Governance
            </span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER 2: AUTHENTICATED SUPER ADMIN CONTROL HUB
  // -------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-purple-950 to-slate-900 rounded-3xl text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <ShieldCheck className="w-72 h-72 text-amber-300" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-amber-400/20 text-amber-200 border border-amber-400/30">
                Super Admin Module
              </span>
              <span className="text-xs text-amber-200/80 font-medium">
                Username: <strong className="font-mono text-white">{adminUsername}</strong>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <span>Chief COE Super Admin Control Hub</span>
            </h1>
            <p className="text-xs sm:text-sm text-amber-100/90 mt-1 max-w-2xl">
              Dedicated provision center to manage Assistant COE (ACOE) users, define Google Drive/Sheet architecture, and oversee overall university convocation photo clearance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            <button
              onClick={() => setIsManualOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-sm transition-all flex items-center gap-1.5 cursor-pointer border border-white/20"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Super Admin Manual
            </button>
            <button
              onClick={loadData}
              disabled={isLoading}
              title="Sync latest records from server"
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Sync Data
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-400/30 text-xs font-semibold backdrop-blur-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogOutIcon className="w-3.5 h-3.5" />
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
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('acoe_management')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'acoe_management'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Appoint & Manage ACOE Users ({coeUsersList.length})
        </button>

        <button
          onClick={() => setActiveTab('system_config')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'system_config'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          System Configuration & Governance
        </button>

        <button
          onClick={() => setActiveTab('system_stats')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'system_stats'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          University Clearance Metrics & Maintenance
        </button>
      </div>


      {/* ------------------------------------------------------------- */}
      {/* TAB 1: ACOE USER PROVISIONING */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'acoe_management' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Appoint ACOE Form */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Appoint ACOE Administrator</h2>
                  <p className="text-xs text-slate-500">Authorize users with access to administrative tools</p>
                </div>
              </div>

              <form onSubmit={handleAddAcoeSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official ACOE Email *
                  </label>
                  <input
                    type="email"
                    value={acoeForm.email}
                    onChange={(e) => setAcoeForm({ ...acoeForm, email: e.target.value })}
                    placeholder="acoe3@hindustanuniv.ac.in"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Must end with @hindustanuniv.ac.in
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ACOE Full Name / Title *
                  </label>
                  <input
                    type="text"
                    value={acoeForm.name}
                    onChange={(e) => setAcoeForm({ ...acoeForm, name: e.target.value })}
                    placeholder="Dr. R. Anitha (ACOE)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Enable Email OTP Dispatch</div>
                    <div className="text-[10px] text-slate-500">Super Admin can toggle this anytime</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={acoeForm.otpEnabled}
                    onChange={(e) => setAcoeForm({ ...acoeForm, otpEnabled: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAddingAcoe}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isAddingAcoe ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Authorizing User...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Appoint ACOE User
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* ACOE Users Table */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Authorized COE Users Directory</h2>
                  <p className="text-xs text-slate-500">Manage ACOE emails and toggle Email OTP status anytime</p>
                </div>
                <button
                  onClick={loadData}
                  className="p-2 text-slate-500 hover:text-amber-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="p-3">User Name / Title</th>
                      <th className="p-3">Login Key (Email)</th>
                      <th className="p-3">Stream Scope</th>
                      <th className="p-3">Email OTP Status</th>
                      <th className="p-3 text-right">OTP & Email Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {coeUsersList.filter(user => user.role !== 'SUPER_ADMIN').map((user, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="p-3 font-semibold text-slate-900">
                          {user.name}
                        </td>
                        <td className="p-3 font-mono text-purple-700 font-medium">
                          {user.username ? (
                            <span className="bg-purple-50 text-purple-800 px-1.5 py-0.5 rounded font-bold border border-purple-200">
                              Username: {user.username}
                            </span>
                          ) : (
                            user.email
                          )}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ALL STREAMS
                          </span>
                        </td>
                        <td className="p-3">
                          {user.role === 'SUPER_ADMIN' ? (
                            <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-200">
                              SUPER ADMIN
                            </span>
                          ) : user.otpEnabled !== false ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200 flex items-center gap-1 w-max">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> OTP ACTIVE
                            </span>
                          ) : (
                            <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-300 flex items-center gap-1 w-max">
                              <X className="w-3 h-3 text-slate-500" /> OTP DISABLED
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-1.5">
                          {user.role !== 'SUPER_ADMIN' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleOtp(user.email, user.otpEnabled !== false)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  user.otpEnabled !== false
                                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                    : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                }`}
                              >
                                {user.otpEnabled !== false ? 'Disable OTP' : 'Enable OTP'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditAcoeEmail(user)}
                                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
                              >
                                Edit Email
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAcoe(user.email)}
                                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-all cursor-pointer"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: SYSTEM CONFIGURATION & GOVERNANCE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'system_config' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Config Form */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">System Configuration & Storage Parameters</h2>
                <p className="text-xs text-slate-500">Manage Google Drive destination folders, Google Sheets synchronization, and active convocation cycles</p>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Google Drive Folder URL *
                  </label>
                  <input
                    type="text"
                    value={driveUrlInput}
                    onChange={(e) => setDriveUrlInput(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Target folder where student passport photos are stored
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Google Spreadsheet URL *
                  </label>
                  <input
                    type="text"
                    value={sheetUrlInput}
                    onChange={(e) => setSheetUrlInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Master synchronization spreadsheet for student data
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Convocation Batch Name *
                    </label>
                    <input
                      type="text"
                      value={batchInput}
                      onChange={(e) => setBatchInput(e.target.value)}
                      placeholder="34th Convocation Ceremony"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Academic Year *
                    </label>
                    <input
                      type="text"
                      value={yearInput}
                      onChange={(e) => setYearInput(e.target.value)}
                      placeholder="2024-2025"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="py-2.5 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSavingConfig ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving Configuration...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Save System Configuration
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Advantage of Config UI Card */}
            <div className="bg-gradient-to-br from-amber-50 via-purple-50 to-indigo-50 p-6 rounded-3xl border border-amber-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <Sparkles className="w-5 h-5 text-amber-700" />
                <span>Advantages of Super Admin Config UI</span>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="bg-white/80 p-3 rounded-xl border border-amber-100 shadow-2xs">
                  <div className="font-bold text-slate-900 mb-1">⚡ Runtime Agility</div>
                  <p className="text-[11px] text-slate-600">
                    Instantly update convocation storage folders, Google Sheets, and ceremony batch headers without touching code or redeploying on Render.
                  </p>
                </div>

                <div className="bg-white/80 p-3 rounded-xl border border-amber-100 shadow-2xs">
                  <div className="font-bold text-slate-900 mb-1">🛡️ Centralized Governance</div>
                  <p className="text-[11px] text-slate-600">
                    Provides a secure, unified administrative control pane to manage institutional academic parameters in one place.
                  </p>
                </div>

                <div className="bg-white/80 p-3 rounded-xl border border-amber-100 shadow-2xs">
                  <div className="font-bold text-slate-900 mb-1">🔒 Error Prevention & Audit</div>
                  <p className="text-[11px] text-slate-600">
                    Eliminates manual environment variable editing or typos by offering clean form inputs with instant validation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ------------------------------------------------------------- */}
      {/* TAB 3: SYSTEM STATS & METRICS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'system_stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block mb-1">Total University Students</span>
              <div className="text-2xl font-extrabold text-slate-900">{stats.totalStudents}</div>
              <span className="text-[10px] text-slate-400 mt-1 block">Across all engineering & non-engineering streams</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block mb-1">Convocation Photo Submissions</span>
              <div className="text-2xl font-extrabold text-slate-900">{stats.totalSubmissions}</div>
              <span className="text-[10px] text-slate-400 mt-1 block">Submitted degree passport photos</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block mb-1">Approved Degrees</span>
              <div className="text-2xl font-extrabold text-emerald-700">{stats.approved}</div>
              <span className="text-[10px] text-slate-400 mt-1 block">Cleared for final print</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block mb-1">Total Department HODs</span>
              <div className="text-2xl font-extrabold text-purple-700">{stats.totalHods}</div>
              <span className="text-[10px] text-slate-400 mt-1 block">Assigned academic HODs</span>
            </div>
          </div>
        </div>
      )}

      {/* User Manual Modal */}
      <UserManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} defaultRole="superadmin" />
    </div>
  );
};
