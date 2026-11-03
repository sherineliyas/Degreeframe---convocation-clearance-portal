import React from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const PhotoGuidelineModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-300" />
              <h3 className="font-bold text-lg tracking-wide uppercase">Office of the Controller of Examinations</h3>
            </div>
            <p className="text-xs text-blue-100">Passport Photograph Guidelines for Degree Certificate</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-700">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800">
              <span className="font-semibold">Notice:</span> Non-compliant photographs will be rejected immediately by the Department Class Teacher and HOD. Adhere strictly to the formal studio specifications below.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Technical Specs
              </h4>
              <ul className="space-y-2 text-xs">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Format:</strong> JPEG (.jpg or .jpeg) only.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>File Size:</strong> Strictly <strong>less than 80 KB</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Dimensions:</strong> Standard 35 mm x 40 mm (width x height).</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Background:</strong> Plain, uniform light-coloured background (white or off-white).</span>
                </li>
              </ul>
            </div>

            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Pose & Lighting
              </h4>
              <ul className="space-y-2 text-xs">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Framing:</strong> Full face, centered, front view from top of hair to bottom of chin.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Expression:</strong> Neutral expression, eyes wide open, mouth closed.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Attire:</strong> Formal academic or professional attire.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Lighting:</strong> Balanced studio light without harsh facial shadows or flash reflections.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border border-rose-200 bg-rose-50/60 rounded-xl p-3.5">
            <h4 className="font-semibold text-rose-900 mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <XCircle className="w-4 h-4 text-rose-600" /> Strict Prohibitions
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-rose-800">
              <div>• No self-taken photos or mobile selfies</div>
              <div>• No dark sunglasses or tinted spectacles</div>
              <div>• No filters, stickers, or beauty retouching</div>
              <div>• No patterned or textured backgrounds</div>
              <div>• No caps, hats, or casual sportswear</div>
              <div>• No blurred, grainy, or scanned low-res prints</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
          >
            I Understand Requirements
          </button>
        </div>
      </div>
    </div>
  );
};
