import { useState, type FormEvent } from 'react';
import { Plus, Trash2, ArrowRight, LogIn, Loader2 } from 'lucide-react';
import { DOMAIN_PROFILES, TOLERANCE_STANDARDS } from '../data/specimens';
import { createStandardPreset, deleteStandardPreset } from '../lib/firestoreService';
import type {
  DomainProfile,
  InspectionStandardPreset,
  ToleranceStandard,
} from '../types/inspection';

interface StandardsViewProps {
  standards: InspectionStandardPreset[];
  isSignedIn: boolean;
  userId: string | null;
  onSignIn: () => void;
  onApplyStandard: (std: InspectionStandardPreset) => void;
}

export function StandardsView({
  standards,
  isSignedIn,
  userId,
  onSignIn,
  onApplyStandard,
}: StandardsViewProps) {
  const [name, setName] = useState('');
  const [domainProfile, setDomainProfile] = useState<DomainProfile>('manufacturing');
  const [toleranceStandard, setToleranceStandard] = useState<ToleranceStandard>('strict');
  const [passThreshold, setPassThreshold] = useState(90);
  const [defectFocus, setDefectFocus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) {
      onSignIn();
      return;
    }
    if (name.trim().length < 2 || defectFocus.trim().length < 3) {
      setErrorMsg('Provide a standard name (2+ chars) and defect focus criteria.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await createStandardPreset({
        ownerId: userId,
        name,
        domainProfile,
        toleranceStandard,
        passThreshold,
        defectFocus,
      });
      setName('');
      setDefectFocus('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save QA standard.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Create Custom Standard Form */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Create QA Standard</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Define reusable pass thresholds and vision focus instructions for your inspection lines.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-3.5">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Standard Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="e.g. Aerospace Flange Rev-C"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Domain</span>
              <select
                value={domainProfile}
                onChange={(e) => setDomainProfile(e.target.value as DomainProfile)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {DOMAIN_PROFILES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Strictness</span>
              <select
                value={toleranceStandard}
                onChange={(e) => {
                  const next = e.target.value as ToleranceStandard;
                  setToleranceStandard(next);
                  const found = TOLERANCE_STANDARDS.find((t) => t.id === next);
                  if (found) setPassThreshold(found.threshold);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {TOLERANCE_STANDARDS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Minimum Pass Score</span>
              <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                {passThreshold}/100
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={98}
              value={passThreshold}
              onChange={(e) => setPassThreshold(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Defect Focus Instructions</span>
            <textarea
              rows={3}
              value={defectFocus}
              onChange={(e) => setDefectFocus(e.target.value)}
              maxLength={500}
              placeholder="e.g. Reject any radial scratch crossing sealing face or burrs around mounting bolt bores."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </label>

          {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isSignedIn ? (
              <Plus className="w-3.5 h-3.5" />
            ) : (
              <LogIn className="w-3.5 h-3.5" />
            )}
            <span>{isSignedIn ? 'Save QA Standard' : 'Sign In to Save Standard'}</span>
          </button>
        </form>
      </div>

      {/* Saved + Built-in Standards */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Your Saved Standards</h3>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {standards.length} saved
            </span>
          </div>

          {!isSignedIn ? (
            <div className="p-6 text-center space-y-2">
              <p className="text-xs text-slate-600">
                Sign in with Google to save and reuse custom QA tolerance profiles across sessions.
              </p>
            </div>
          ) : standards.length === 0 ? (
            <div className="p-6 text-center space-y-1">
              <p className="text-sm font-medium text-slate-900">No Custom Standards Yet</p>
              <p className="text-xs text-slate-500">
                Create a custom rule set on the left to tailor automated defect scoring.
              </p>
            </div>
          ) : (
            standards.map((std) => (
              <div key={std.id} className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{std.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 capitalize">
                    <span>{std.domainProfile}</span>
                    <span aria-hidden="true">·</span>
                    <span>{std.toleranceStandard}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">Pass &ge; {std.passThreshold}</span>
                  </div>
                  <p className="text-xs text-slate-600 pt-1">{std.defectFocus}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onApplyStandard(std)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap"
                  >
                    <span>Apply</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteStandardPreset(std.id)}
                    aria-label={`Delete ${std.name}`}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Built-in Reference Baselines */}
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          <div className="px-5 py-3.5">
            <h3 className="text-sm font-semibold text-slate-900">Built-In Domain Baselines</h3>
          </div>
          {DOMAIN_PROFILES.map((prof) => (
            <div key={prof.id} className="px-5 py-3 flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-900">{prof.label}</p>
                <p className="text-xs text-slate-600">{prof.focus}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
