import React from 'react';
import { GraduationCap } from 'lucide-react';
import { PortalRoute } from '../utils/router';

interface Props {
  activePortal: PortalRoute;
}

export const Navbar: React.FC<Props> = ({ activePortal }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-xs">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                DegreeFrame
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                activePortal === 'superadmin'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : activePortal === 'coe'
                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {activePortal === 'superadmin' ? 'SUPER ADMIN' : activePortal === 'coe' ? 'COE ADMIN' : 'HITS'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
              {activePortal === 'student'
                ? 'Convocation Photo Clearance Portal — Student Portal'
                : activePortal === 'superadmin'
                ? 'Chief COE Governance Hub — Super Admin Control'
                : activePortal === 'coe'
                ? 'Convocation Clearance Administration — Controller of Examinations (COE)'
                : 'Convocation Photo Clearance Portal — Faculty & HOD Review'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
