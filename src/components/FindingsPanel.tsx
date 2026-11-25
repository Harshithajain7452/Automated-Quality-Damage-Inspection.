import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  BookmarkCheck,
  Download,
  Play,
  Loader2,
} from 'lucide-react';
import { DOMAIN_PROFILES, TOLERANCE_STANDARDS } from '../data/specimens';
import type {
  DefectFinding,
  DomainProfile,
  InspectionResult,
  InspectionStandardPreset,
  ToleranceStandard,
  Verdict,
} from '../types/inspection';

interface FindingsPanelProps {
  assetLabel: string;
  onAssetLabelChange: (val: string) => void;
  batchId: string;
  onBatchIdChange: (val: string) => void;
  domainProfile: DomainProfile;
  onDomainProfileChange: (val: DomainProfile) => void;
  toleranceStandard: ToleranceStandard;
  onToleranceStandardChange: (val: ToleranceStandard) => void;
  customFocus: string;
  onCustomFocusChange: (val: string) => void;
  customStandards: InspectionStandardPreset[];
  onApplyPreset: (preset: InspectionStandardPreset) => void;
  onRunInspection: () => void;
  isInspecting: boolean;
  canRunInspection: boolean;
  inspectionError: string | null;
  result: InspectionResult | null;
  selectedDefectId: string | null;
  onSelectDefect: (id: string | null) => void;
  verdictOverride: Verdict | null;
  onVerdictOverrideChange: (v: Verdict) => void;
  inspectorNotes: string;
  onInspectorNotesChange: (notes: string) => void;
  onSaveToLedger: () => void;
  isSaving: boolean;
  savedRecordId: string | null;
  onExportJson: () => void;
  isSignedIn: boolean;
}

const VERDICT_META: Record<
  Verdict,
  {
    label: string;
    icon: typeof CheckCircle2;
    containerClass: string;
    textClass: string;
  }
> = {
  PASS: {
    label: 'PASS — Within Tolerance',
    icon: CheckCircle2,
    containerClass: 'bg-emerald-50 border-emerald-200',
    textClass: 'text-emerald-800',
  },
  CONDITIONAL: {
    label: 'CONDITIONAL — Secondary Review',
    icon: AlertTriangle,
    containerClass: 'bg-amber-50 border-amber-200',
    textClass: 'text-amber-800',
  },
  FAIL: {
    label: 'FAIL — Non-Conforming',
    icon: ShieldAlert,
    containerClass: 'bg-red-50 border-red-200',
    textClass: 'text-red-800',
  },
};

const SEVERITY_TEXT_COLOR: Record<DefectFinding['severity'], string> = {
  CRITICAL: 'text-red-700',
  MAJOR: 'text-amber-700',
  MINOR: 'text-blue-700',
};

export function FindingsPanel({
  assetLabel,
  onAssetLabelChange,
  batchId,
  onBatchIdChange,
  domainProfile,
  onDomainProfileChange,
  toleranceStandard,
  onToleranceStandardChange,
  customFocus,
  onCustomFocusChange,
  customStandards,
  onApplyPreset,
  onRunInspection,
  isInspecting,
  canRunInspection,
  inspectionError,
  result,
  selectedDefectId,
  onSelectDefect,
  verdictOverride,
  onVerdictOverrideChange,
  inspectorNotes,
  onInspectorNotesChange,
  onSaveToLedger,
  isSaving,
  savedRecordId,
  onExportJson,
  isSignedIn,
}: FindingsPanelProps) {
  const effectiveVerdict = verdictOverride || result?.verdict || 'CONDITIONAL';
  const verdictMeta = VERDICT_META[effectiveVerdict];
  const VerdictIcon = verdictMeta.icon;

  return (
    <div className="space-y-4">
      {/* Configuration Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Inspection Parameters</h2>
          {customStandards.length > 0 && (
            <select
              aria-label="Apply saved QA standard"
              defaultValue=""
              onChange={(e) => {
                const found = customStandards.find((s) => s.id === e.target.value);
                if (found) onApplyPreset(found);
              }}
              className="text-xs border border-slate-200 rounded-md px-2.5 py-1.5 bg-slate-50 text-slate-700 max-w-[180px]"
            >
              <option value="" disabled>
                Load Saved Standard...
              </option>
              {customStandards.map((std) => (
                <option key={std.id} value={std.id}>
                  {std.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Asset / Part Label</span>
            <input
              type="text"
              value={assetLabel}
              onChange={(e) => onAssetLabelChange(e.target.value)}
              maxLength={120}
              placeholder="e.g. Flange 741-B-001"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Lot / Batch ID</span>
            <input
              type="text"
              value={batchId}
              onChange={(e) => onBatchIdChange(e.target.value)}
              maxLength={64}
              placeholder="e.g. LOT-2026-041"
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Inspection Domain</span>
            <select
              value={domainProfile}
              onChange={(e) => onDomainProfileChange(e.target.value as DomainProfile)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {DOMAIN_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Tolerance Standard</span>
            <select
              value={toleranceStandard}
              onChange={(e) => onToleranceStandardChange(e.target.value as ToleranceStandard)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
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
          <span className="text-xs font-medium text-slate-600">Custom Focus Criteria (Optional)</span>
          <input
            type="text"
            value={customFocus}
            onChange={(e) => onCustomFocusChange(e.target.value)}
            maxLength={500}
            placeholder="e.g. Check bore chamfer and anodized sealing face for scratches"
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </label>

        <button
          type="button"
          onClick={onRunInspection}
          disabled={!canRunInspection || isInspecting}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
        >
          {isInspecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Running Automated Inspection...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Run Automated Inspection</span>
            </>
          )}
        </button>

        {inspectionError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
            {inspectionError}
          </div>
        )}
      </div>

      {/* Results & Findings Card */}
      {result ? (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          {/* Verdict Summary */}
          <div className="p-4 space-y-3">
            <div className={`p-3 border rounded-md flex items-center justify-between gap-3 ${verdictMeta.containerClass}`}>
              <div className="flex items-center gap-2 min-w-0">
                <VerdictIcon className={`w-5 h-5 shrink-0 ${verdictMeta.textClass}`} />
                <span className={`text-sm font-semibold truncate ${verdictMeta.textClass}`}>
                  {verdictMeta.label}
                </span>
              </div>
              <span className={`font-mono text-lg font-bold tabular-nums shrink-0 ${verdictMeta.textClass}`}>
                {result.qualityScore}/100
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>Surface: {result.surfaceCondition}</span>
              <span aria-hidden="true">·</span>
              <span>Structure: {result.structuralIntegrity}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{result.defects.length} findings</span>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>

            <div className="text-xs text-slate-600 pt-1">
              <span className="font-semibold text-slate-800">Disposition: </span>
              <span>{result.recommendedAction}</span>
            </div>
          </div>

          {/* Detected Defects List */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-800">
                Localized Defect Findings
              </h3>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {result.defects.length} detected
              </span>
            </div>

            {result.defects.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                No surface or structural defects were detected under the selected tolerance standard.
              </p>
            ) : (
              <div className="space-y-2">
                {result.defects.map((defect, index) => {
                  const isSelected = selectedDefectId === defect.id;
                  return (
                    <button
                      key={defect.id}
                      type="button"
                      onClick={() => onSelectDefect(isSelected ? null : defect.id)}
                      className={`w-full text-left p-3 border rounded-md transition-colors ${
                        isSelected
                          ? 'bg-blue-50/60 border-blue-500'
                          : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          #{index + 1} {defect.defectType}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] font-mono shrink-0 tabular-nums">
                          <span className={`font-semibold ${SEVERITY_TEXT_COLOR[defect.severity]}`}>
                            {defect.severity}
                          </span>
                          <span className="text-slate-400" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-slate-600">
                            {Math.round(defect.confidence * 100)}% conf
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{defect.locationDescription}</p>
                      <p className="text-xs text-slate-500 mt-1.5">
                        <span className="font-medium text-slate-700">Remediation: </span>
                        {defect.remediation}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* QA Sign-Off & Persistence */}
          <div className="p-4 space-y-3 bg-slate-50/60">
            <h3 className="text-xs font-semibold text-slate-800">QA Sign-Off &amp; Ledger</h3>

            <div className="space-y-1.5">
              <span className="text-xs text-slate-600 block">Final Verdict</span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-md">
                {(['PASS', 'CONDITIONAL', 'FAIL'] as Verdict[]).map((v) => {
                  const active = effectiveVerdict === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onVerdictOverrideChange(v)}
                      className={`px-2 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block space-y-1">
              <span className="text-xs text-slate-600">Inspector Notes</span>
              <textarea
                rows={2}
                value={inspectorNotes}
                onChange={(e) => onInspectorNotesChange(e.target.value)}
                maxLength={1000}
                placeholder="Optional disposition notes or caliper verification measurements..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onSaveToLedger}
                disabled={isSaving || Boolean(savedRecordId)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-md transition-colors whitespace-nowrap"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Record...</span>
                  </>
                ) : savedRecordId ? (
                  <>
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>Saved to Audit Ledger</span>
                  </>
                ) : (
                  <>
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>{isSignedIn ? 'Save to Audit Ledger' : 'Sign In & Save Record'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onExportJson}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center space-y-1.5">
          <p className="text-sm font-medium text-slate-900">Ready for Visual Diagnostics</p>
          <p className="text-xs text-slate-500">
            Select a specimen or upload an image, verify domain parameters, and run automated inspection.
          </p>
        </div>
      )}
    </div>
  );
}
