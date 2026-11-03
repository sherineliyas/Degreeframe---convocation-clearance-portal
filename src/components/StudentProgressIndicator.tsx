import React from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Camera,
  ShieldCheck,
  Search,
  AlertTriangle,
  Award,
} from 'lucide-react';
import { ApprovalStatus } from '../types';

export interface StepProgressProps {
  currentStep: 1 | 2 | 3 | 4;
  onStepClick?: (step: 1 | 2 | 3) => void;
  requires10thProof: boolean;
  has10thProof: boolean;
  requiresTcProof: boolean;
  hasTcProof: boolean;
  hasPhoto: boolean;
  photoSizeKb: number;
  isConfirmed: boolean;
}

export const StepProgressIndicator: React.FC<StepProgressProps> = ({
  currentStep,
  onStepClick,
  requires10thProof,
  has10thProof,
  requiresTcProof,
  hasTcProof,
  hasPhoto,
  photoSizeKb,
  isConfirmed,
}) => {
  const steps = [
    { number: 1, label: 'Profile Lookup', sub: 'Enrollment Record', icon: Search },
    { number: 2, label: 'Verify Details', sub: 'Certificates & Proofs', icon: FileText },
    { number: 3, label: 'Degree Photo', sub: '35x40mm (< 80KB)', icon: Camera },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-4">
      {/* Step Numbers & Connection Line */}
      <div className="relative">
        {/* Progress bar background line */}
        <div className="absolute top-5 left-8 right-8 h-1 bg-slate-200 -z-0 hidden sm:block" />
        <div
          className="absolute top-5 left-8 h-1 bg-blue-600 transition-all duration-300 -z-0 hidden sm:block"
          style={{
            width:
              currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%',
          }}
        />

        <div className="grid grid-cols-3 gap-2 relative z-10">
          {steps.map((st) => {
            const isCompleted = currentStep > st.number;
            const isCurrent = currentStep === st.number;
            const isClickable = onStepClick && currentStep > st.number;
            const Icon = st.icon;

            return (
              <button
                key={st.number}
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(st.number as 1 | 2 | 3)}
                className={`flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-xl transition-all ${
                  isClickable ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
                }`}
              >
                {/* Circle Icon */}
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 transition-all shadow-xs ${
                    isCompleted
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                      : isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 ring-offset-1'
                      : 'bg-slate-100 text-slate-400 border border-slate-300'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>

                {/* Text Label */}
                <div className="min-w-0">
                  <span
                    className={`block text-xs font-bold leading-tight ${
                      isCurrent
                        ? 'text-blue-700'
                        : isCompleted
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {st.label}
                  </span>
                  <span className="hidden sm:block text-[11px] text-slate-500 font-medium truncate">
                    {st.sub}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Photo and Mandatory Document Checklist Badges */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
        {/* 10th Proof Badge - only shown if name edited */}
        {requires10thProof && (
          <span
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border ${
              has10thProof
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            {has10thProof ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            )}
            <span>10th Marksheet: {has10thProof ? 'Attached' : 'Required for Name Edit'}</span>
          </span>
        )}

        {/* TC Proof Badge - only shown if profile details edited */}
        {requiresTcProof && (
          <span
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border ${
              hasTcProof
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            {hasTcProof ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            )}
            <span>TC Proof: {hasTcProof ? 'Attached' : 'Required for Profile Edit'}</span>
          </span>
        )}

        {/* Photo Status Badge */}
        <span
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border ${
            hasPhoto && photoSizeKb <= 80
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : hasPhoto && photoSizeKb > 80
              ? 'bg-rose-50 text-rose-800 border-rose-300'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {hasPhoto && photoSizeKb <= 80 ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          ) : hasPhoto && photoSizeKb > 80 ? (
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
          ) : (
            <Camera className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>
            {hasPhoto
              ? photoSizeKb <= 80
                ? `Photo Ready (${photoSizeKb} KB)`
                : `Photo Exceeds 80KB (${photoSizeKb} KB)`
              : 'Degree Photo: Pending'}
          </span>
        </span>
      </div>
    </div>
  );
};

export interface ReviewStateProgressProps {
  status: ApprovalStatus | string;
  teacherRemarks?: string;
  hodRemarks?: string;
  deanRemarks?: string;
  studentName?: string;
  regNo?: string;
  submissionId?: string;
}

export const ReviewStateProgressIndicator: React.FC<ReviewStateProgressProps> = ({
  status,
  teacherRemarks,
  hodRemarks,
  deanRemarks,
  studentName,
  regNo,
  submissionId,
}) => {
  const normStatus = (status || '').toUpperCase().trim();

  const isTeacherRejected = normStatus === 'REJECTED_BY_TEACHER';
  const isHodRejected = normStatus === 'REJECTED_BY_HOD';
  const isRejected = isTeacherRejected || isHodRejected || normStatus.includes('REJECT');

  const isTeacherPending = normStatus === 'PENDING_TEACHER';
  const isHodPending = normStatus === 'PENDING_HOD';
  const isApproved = normStatus === 'APPROVED';

  // Stages configuration
  const stages = [
    {
      id: 'submitted',
      title: 'Application Submitted',
      description: 'Photo and certificates uploaded',
      state: 'completed' as 'completed' | 'current' | 'pending' | 'rejected',
    },
    {
      id: 'teacher',
      title: 'Class Teacher Review',
      description: isTeacherPending
        ? 'Under section verification'
        : isTeacherRejected
        ? 'Rejected with remarks'
        : 'Approved by Teacher',
      state: isTeacherPending
        ? ('current' as const)
        : isTeacherRejected
        ? ('rejected' as const)
        : ('completed' as const),
      remarks: teacherRemarks,
    },
    {
      id: 'hod',
      title: 'Department HOD Approval',
      description: isHodPending
        ? 'Under HOD review'
        : isHodRejected
        ? 'Rejected with remarks'
        : isApproved
        ? 'Approved by HOD'
        : 'Awaiting Teacher clearance',
      state: isHodPending
        ? ('current' as const)
        : isHodRejected
        ? ('rejected' as const)
        : isApproved
        ? ('completed' as const)
        : ('pending' as const),
      remarks: hodRemarks,
    },
    {
      id: 'cleared',
      title: 'Convocation Clearance',
      description: isApproved
        ? 'Degree Certificate photo finalized'
        : 'Pending departmental approvals',
      state: isApproved ? ('completed' as const) : ('pending' as const),
      remarks: deanRemarks,
    },
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-6">
      {/* Header bar with Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
            Review Pipeline Tracker {submissionId ? `• Ref: ${submissionId}` : ''}
          </span>
          <h4 className="text-base font-bold text-slate-900 mt-0.5">
            {studentName ? `${studentName} (${regNo || ''})` : 'Clearance Review Progress'}
          </h4>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border tracking-wide uppercase inline-flex items-center gap-1.5 ${
              isApproved
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : isRejected
                ? 'bg-rose-100 text-rose-800 border-rose-300'
                : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}
          >
            {isApproved ? (
              <Award className="w-3.5 h-3.5 text-emerald-700" />
            ) : isRejected ? (
              <XCircle className="w-3.5 h-3.5 text-rose-700" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
            )}
            <span>{status}</span>
          </span>
        </div>
      </div>

      {/* 4-Stage Stepper Track */}
      <div className="relative">
        {/* Connecting Line */}
        <div className="absolute top-5 left-6 right-6 h-1 bg-slate-100 -z-0 hidden md:block" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
          {stages.map((st, idx) => {
            const isStageCompleted = st.state === 'completed';
            const isStageCurrent = st.state === 'current';
            const isStageRejected = st.state === 'rejected';

            return (
              <div
                key={st.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isStageCurrent
                    ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-200 shadow-xs'
                    : isStageRejected
                    ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-200 shadow-xs'
                    : isStageCompleted
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-slate-50/60 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      isStageCompleted
                        ? 'bg-emerald-600 text-white'
                        : isStageCurrent
                        ? 'bg-amber-600 text-white animate-pulse'
                        : isStageRejected
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isStageCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : isStageRejected ? (
                      <XCircle className="w-4 h-4 text-white" />
                    ) : isStageCurrent ? (
                      <Clock className="w-4 h-4 text-white" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className="font-bold text-xs text-slate-900 leading-tight">
                    {st.title}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {st.description}
                </p>

                {/* Remarks display if present on this stage */}
                {st.remarks && (
                  <div
                    className={`mt-2 p-2 rounded-xl text-[11px] border leading-relaxed ${
                      isStageRejected
                        ? 'bg-rose-100/70 text-rose-900 border-rose-200 font-medium'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    <span className="font-semibold block text-[10px] uppercase text-slate-500">
                      Feedback:
                    </span>
                    <em>"{st.remarks}"</em>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
