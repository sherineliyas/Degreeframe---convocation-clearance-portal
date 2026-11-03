import React, { useState, useEffect } from 'react';
import { BookOpen, Printer, X, GraduationCap, ShieldCheck, Users, User, FileText, CheckCircle2, Download } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: 'student' | 'faculty' | 'coe' | 'superadmin' | 'deployment';
}

export const UserManualModal: React.FC<Props> = ({ isOpen, onClose, defaultRole = 'student' }) => {
  const [activeSection, setActiveSection] = useState<'student' | 'faculty' | 'coe' | 'superadmin' | 'deployment'>(defaultRole);

  useEffect(() => {
    if (isOpen && defaultRole) {
      setActiveSection(defaultRole);
    }
  }, [isOpen, defaultRole]);

  if (!isOpen) return null;

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white backdrop-blur-md">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">
                HITS Convocation Portal — Official User & Deployment Manual
              </h2>
              <p className="text-xs text-blue-200 mt-0.5">
                Comprehensive step-by-step documentation for Students, Faculty, COE, Super Admin, and Render Deployment
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPdf}
              className="px-3.5 py-2 rounded-xl bg-white text-blue-900 text-xs font-bold hover:bg-blue-50 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              title="Print or Save as PDF"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveSection('student')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSection === 'student' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:bg-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Student Guide
          </button>
          <button
            onClick={() => setActiveSection('faculty')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSection === 'faculty' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:bg-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Faculty & HOD Guide
          </button>
          <button
            onClick={() => setActiveSection('coe')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSection === 'coe' ? 'bg-purple-700 text-white shadow-xs' : 'text-slate-600 hover:bg-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            COE Admin Guide
          </button>
          <button
            onClick={() => setActiveSection('superadmin')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSection === 'superadmin' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Super Admin Guide
          </button>
          <button
            onClick={() => setActiveSection('deployment')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSection === 'deployment' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:bg-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Render Deployment & SMTP
          </button>
        </div>

        {/* Manual Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-xs sm:text-sm leading-relaxed bg-white">
          
          {/* STUDENT GUIDE */}
          {activeSection === 'student' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  User Role: Student
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                  Student Graduation Clearance & Convocation Photo Portal Manual
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  How students submit passport-size convocation photographs, track verification progress, and download digital clearance certificates.
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
                    <span>Accessing the Student Portal & Logging In</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    Navigate to the HITS Convocation Portal and click the <strong>Student</strong> tab. Enter your official University Register Number (e.g., <code className="font-mono bg-blue-100 text-blue-900 px-1 py-0.5 rounded">19251001</code>) and date of birth or authentication key to sign in securely.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
                    <span>Reviewing Academic Details & Program Stream</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    Verify your pre-filled academic details including Full Name, Register Number, Degree Stream (Engineering, Non-Engineering, or Postgraduate), Branch, CGPA, and Passing Year.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
                    <span>Uploading Convocation Passport Photo</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    Click <strong>Upload Photo</strong>. Ensure your photograph strictly complies with institutional convocation guidelines: solid white background, formal attire, recent studio capture, clear face visibility without glasses glare or hats, and high resolution (PNG/JPG). Use the built-in photo crop & preview tool before submitting.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">4</span>
                    <span>Tracking Clearance Status & Downloading Certificate</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    Monitor your 4-stage clearance progress indicator: Submission → Faculty Review → HOD Approval → COE Final Approval. Once approved by the Controller of Examinations, download your official digital Convocation Clearance Certificate.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* FACULTY & HOD GUIDE */}
          {activeSection === 'faculty' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  User Role: Faculty & HOD
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                  Faculty Advisor & Department HOD Review Portal Manual
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  How faculty reviewers and department heads authenticate via email OTP, inspect student photographs, approve/reject submissions, and manage faculty assignments.
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">1</span>
                    <span>Secure Email OTP Authentication</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    Go to the <strong>Faculty & HOD</strong> tab, enter your official faculty email (<code className="font-mono bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded">faculty@hindustanuniv.ac.in</code>), and click <strong>Send OTP</strong>. Enter the 6-digit verification code sent to your email to log in.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">2</span>
                    <span>Reviewing Student Submissions</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    View the list of students assigned to your department. Use the inspection modal to view high-resolution passport photographs, 10th marksheet proof, and Transfer Certificate (TC) proof.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">3</span>
                    <span>Approving or Rejecting Submissions</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    Click <strong>Approve</strong> to forward the student's photo to the HOD and COE queues. If the photo does not meet standards (e.g., blurry or incorrect background), click <strong>Reject</strong> and provide mandatory rejection remarks so the student can re-upload.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">4</span>
                    <span>HOD Feature: Appointing Department Faculty</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    Department HODs have authorization to appoint and manage departmental faculty advisors, assign verification streams, and monitor departmental clearance bottlenecks.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* COE ADMIN GUIDE */}
          {activeSection === 'coe' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                  User Role: Controller of Examinations (COE / ACOE)
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                  COE Administration & Convocation Clearance Hub Manual
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  How Assistant COE administrators manage convocation queues across streams, synchronize Google Drive & Sheets, and issue official degree certificates.
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">1</span>
                    <span>Logging into COE Portal with Email OTP</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    Navigate to the <strong>COE Admin</strong> portal, enter your authorized ACOE email (e.g., <code className="font-mono bg-purple-100 text-purple-900 px-1 py-0.5 rounded">acoe1@hindustanuniv.ac.in</code>), and verify with Email OTP.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">2</span>
                    <span>Managing Convocation Clearance Queue</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    Review faculty-approved student applications. Filter by Engineering, Non-Engineering, or Postgraduate streams. Perform final COE approval to officially clear students for degree printing.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">3</span>
                    <span>Google Drive & Google Sheets Integration</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    Monitor synchronization of student passport photos directly into the institutional Google Drive folder and student records into the Google Sheet master database.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SUPER ADMIN GUIDE */}
          {activeSection === 'superadmin' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  User Role: Chief COE Super Admin
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                  Chief COE Super Admin Control Hub Manual
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  How the Chief Super Admin appoints ACOE users, toggles Email OTP dispatch per ACOE user, and configures system-wide governance parameters.
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs">1</span>
                    <span>Super Admin Authentication</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    Access the <strong>Super Admin</strong> portal. Log in using the Chief Super Admin credentials (<code className="font-mono bg-amber-100 text-amber-900 px-1 py-0.5 rounded">superadmin</code> / <code className="font-mono bg-amber-100 text-amber-900 px-1 py-0.5 rounded">Admin@123</code>). No email verification is required for the chief super admin.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs">2</span>
                    <span>Appointing ACOE Users & Toggling Email OTP</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    Use the <strong>Appoint & Manage ACOE Users</strong> tab to add official ACOE emails (e.g., <code className="font-mono bg-amber-100 text-amber-900 px-1 py-0.5 rounded">acoe1@hindustanuniv.ac.in</code>). Toggle <strong>Enable Email OTP Dispatch</strong> individually for each ACOE user. This allows flexible email dispatch configuration without modifying environment variables on Render.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs">3</span>
                    <span>System Configuration & Governance Parameters</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    Update Google Drive folder URLs, Google Sheets master URLs, convocation batch names, and academic years dynamically from the UI.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* DEPLOYMENT & SMTP GUIDE */}
          {activeSection === 'deployment' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-300">
                  Deployment & Infrastructure Guide
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                  Beginner-Friendly Deployment Guide: GitHub to Render & SMTP Configuration
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  Complete instructions for uploading your project to GitHub, deploying to Render from another laptop/account, and configuring SMTP environment variables.
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs">1</span>
                    <span>Pushing Code to GitHub</span>
                  </div>
                  <ol className="list-decimal list-inside text-xs text-slate-600 pl-4 space-y-1">
                    <li>Create a new repository on GitHub (e.g., <code className="font-mono bg-slate-200 px-1 py-0.5 rounded">hits-convocation-portal</code>).</li>
                    <li>Open your terminal in the project folder and run:
                      <pre className="bg-slate-900 text-emerald-400 p-2.5 rounded-xl font-mono text-[11px] my-1.5 overflow-x-auto">
{`git init
git add .
git commit -m "Initial HITS Convocation Portal deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/hits-convocation-portal.git
git push -u origin main`}
                      </pre>
                    </li>
                  </ol>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs">2</span>
                    <span>Deploying on Render (Web Service)</span>
                  </div>
                  <ol className="list-decimal list-inside text-xs text-slate-600 pl-4 space-y-1">
                    <li>Log into <a href="https://render.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">Render Dashboard</a> with your official account.</li>
                    <li>Click <strong>New +</strong> → <strong>Web Service</strong>.</li>
                    <li>Connect your GitHub repository (<code className="font-mono bg-slate-200 px-1 py-0.5 rounded">hits-convocation-portal</code>).</li>
                    <li>Configure build settings:
                      <ul className="list-disc list-inside pl-4 mt-1 space-y-0.5 text-slate-600">
                        <li><strong>Environment:</strong> Node / TypeScript</li>
                        <li><strong>Build Command:</strong> <code className="font-mono bg-slate-200 px-1 py-0.5 rounded">npm install && npm run build</code></li>
                        <li><strong>Start Command:</strong> <code className="font-mono bg-slate-200 px-1 py-0.5 rounded">node server.ts</code> (or <code className="font-mono bg-slate-200 px-1 py-0.5 rounded">npm start</code>)</li>
                      </ul>
                    </li>
                  </ol>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs">3</span>
                    <span>Configuring Environment Variables on Render</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    Under the <strong>Advanced</strong> section on Render, add these environment variables:
                  </p>
                  <div className="bg-slate-900 text-emerald-300 p-3 rounded-xl font-mono text-[11px] ml-8 space-y-1">
                    <div>SMTP_HOST=smtp.gmail.com</div>
                    <div>SMTP_PORT=587</div>
                    <div>SMTP_USER=coe@hindustanuniv.ac.in</div>
                    <div>SMTP_PASS=(Your Gmail App Password)</div>
                    <div>FROM_EMAIL=Controller of Examinations &lt;coe@hindustanuniv.ac.in&gt;</div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs">4</span>
                    <span>Email OTP Dispatch Control & Super Admin Management</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-8">
                    The backend uses the global SMTP configuration on Render. In the <strong>Super Admin Control Hub</strong>, you can appoint ACOE users (e.g., <code className="font-mono bg-slate-200 px-1 py-0.5 rounded">acoe1@hindustanuniv.ac.in</code>) and toggle <strong>Enable Email OTP Dispatch</strong> on or off. This allows you to manage authorized ACOE dispatch without needing to update environment variables on Render every time an ACOE user changes.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Hindustan Institute of Technology & Science (HITS) • Convocation Portal Manual v2.5
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            Close Manual
          </button>
        </div>

      </div>
    </div>
  );
};
