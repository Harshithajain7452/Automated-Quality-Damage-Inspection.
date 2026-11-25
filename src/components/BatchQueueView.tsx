import { useRef, useState } from 'react';
import {
  Upload,
  Play,
  Trash2,
  BookmarkCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Layers,
} from 'lucide-react';
import { DOMAIN_PROFILES, SAMPLE_SPECIMENS, TOLERANCE_STANDARDS } from '../data/specimens';
import { fetchImageUrlAsEncodedImage, readFileAsEncodedImage } from '../lib/imageUtils';
import type {
  BatchQueueItem,
  DomainProfile,
  InspectionResult,
  ToleranceStandard,
} from '../types/inspection';

interface BatchQueueViewProps {
  items: BatchQueueItem[];
  onSetItems: React.Dispatch<React.SetStateAction<BatchQueueItem[]>>;
  onSaveBatchItem: (item: BatchQueueItem, batchId: string, domain: DomainProfile, tolerance: ToleranceStandard) => Promise<string | null>;
  isSignedIn: boolean;
  onRequestSignIn: () => void;
  onInspectInStage: (item: BatchQueueItem) => void;
}

export function BatchQueueView({
  items,
  onSetItems,
  onSaveBatchItem,
  isSignedIn,
  onRequestSignIn,
  onInspectInStage,
}: BatchQueueViewProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [batchId, setBatchId] = useState(`BATCH-${new Date().toISOString().slice(0, 10)}`);
  const [domainProfile, setDomainProfile] = useState<DomainProfile>('manufacturing');
  const [toleranceStandard, setToleranceStandard] = useState<ToleranceStandard>('standard');
  const [isRunning, setIsRunning] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: BatchQueueItem[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const encoded = await readFileAsEncodedImage(file);
        added.push({
          id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          assetLabel: file.name.replace(/\.[^.]+$/, ''),
          previewUrl: encoded.dataUrl,
          base64: encoded.base64,
          mimeType: encoded.mimeType,
          state: 'queued',
        });
      } catch {
        // Skip unreadable file
      }
    }
    if (added.length > 0) {
      onSetItems((prev) => [...prev, ...added]);
    }
  };

  const handleLoadSampleBatch = async () => {
    const loaded: BatchQueueItem[] = [];
    for (const spec of SAMPLE_SPECIMENS) {
      try {
        const encoded = await fetchImageUrlAsEncodedImage(spec.imageUrl);
        loaded.push({
          id: `q_${spec.id}_${Date.now()}`,
          assetLabel: spec.title,
          previewUrl: spec.imageUrl,
          base64: encoded.base64,
          mimeType: encoded.mimeType,
          state: 'queued',
        });
      } catch {
        // Ignore single fetch error
      }
    }
    if (loaded.length > 0) {
      onSetItems((prev) => [...prev, ...loaded]);
    }
  };

  const runBatch = async () => {
    if (isRunning) return;
    setIsRunning(true);

    const targets = items.filter((item) => item.state === 'queued' || item.state === 'error');
    for (const target of targets) {
      onSetItems((prev) =>
        prev.map((it) => (it.id === target.id ? { ...it, state: 'inspecting', errorMessage: undefined } : it))
      );

      try {
        const res = await fetch('/api/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: target.base64,
            mimeType: target.mimeType,
            domainProfile,
            toleranceStandard,
            assetLabel: target.assetLabel,
          }),
        });
        const data = (await res.json()) as InspectionResult & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || `Inspection failed (${res.status})`);
        }
        onSetItems((prev) =>
          prev.map((it) => (it.id === target.id ? { ...it, state: 'completed', result: data } : it))
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Batch item inspection failed.';
        onSetItems((prev) =>
          prev.map((it) => (it.id === target.id ? { ...it, state: 'error', errorMessage: message } : it))
        );
      }
    }

    setIsRunning(false);
  };

  const handleSaveAll = async () => {
    if (!isSignedIn) {
      onRequestSignIn();
      return;
    }
    setIsSavingAll(true);
    const unsaved = items.filter((it) => it.state === 'completed' && it.result && !it.savedId);
    for (const item of unsaved) {
      const savedId = await onSaveBatchItem(item, batchId, domainProfile, toleranceStandard);
      if (savedId) {
        onSetItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, savedId } : it)));
      }
    }
    setIsSavingAll(false);
  };

  const completedItems = items.filter((i) => i.state === 'completed' && i.result);
  const passCount = completedItems.filter((i) => i.result?.verdict === 'PASS').length;
  const failCount = completedItems.filter((i) => i.result?.verdict === 'FAIL').length;
  const avgScore =
    completedItems.length > 0
      ? Math.round(
          completedItems.reduce((acc, i) => acc + (i.result?.qualityScore ?? 0), 0) / completedItems.length
        )
      : 0;
  const unsavedCount = completedItems.filter((i) => !i.savedId).length;

  return (
    <div className="space-y-6">
      {/* Batch Controls & KPIs */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Multi-Specimen Batch Runner</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Queue multiple production or inbound freight images for sequential automated inspection.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Add Images</span>
            </button>
            <button
              type="button"
              onClick={handleLoadSampleBatch}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Load 4 Sample Specimens</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Batch Identifier</span>
            <input
              type="text"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              maxLength={64}
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Domain Profile</span>
            <select
              value={domainProfile}
              onChange={(e) => setDomainProfile(e.target.value as DomainProfile)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {DOMAIN_PROFILES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Tolerance Standard</span>
            <select
              value={toleranceStandard}
              onChange={(e) => setToleranceStandard(e.target.value as ToleranceStandard)}
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

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-mono tabular-nums">
            <span>Queued: {items.length}</span>
            <span aria-hidden="true">·</span>
            <span>Passed: {passCount}</span>
            <span aria-hidden="true">·</span>
            <span>Failed: {failCount}</span>
            <span aria-hidden="true">·</span>
            <span>Mean Score: {completedItems.length ? `${avgScore}/100` : '--'}</span>
          </div>

          <div className="flex items-center gap-2">
            {unsavedCount > 0 && (
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSavingAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
              >
                {isSavingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BookmarkCheck className="w-3.5 h-3.5" />
                )}
                <span>{isSignedIn ? `Save ${unsavedCount} to Ledger` : 'Sign In & Save Batch'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={runBatch}
              disabled={isRunning || items.every((i) => i.state === 'completed')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Inspecting Batch...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Batch Inspection</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {items.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">Batch Queue Empty</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Add local specimen photos or load the 4 reference specimens to run automated batch quality checks.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Specimen</th>
                  <th className="py-2.5 px-4">Processing State</th>
                  <th className="py-2.5 px-4">Verdict</th>
                  <th className="py-2.5 px-4 text-right">Score</th>
                  <th className="py-2.5 px-4 text-right">Defects</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {items.map((item) => {
                  const verdict = item.result?.verdict;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.previewUrl}
                            alt={item.assetLabel}
                            referrerPolicy="no-referrer"
                            className="w-11 h-9 object-cover rounded-xs border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-900 truncate max-w-[220px]">
                              {item.assetLabel}
                            </p>
                            {item.errorMessage && (
                              <p className="text-[11px] text-red-600 truncate max-w-[260px]">
                                {item.errorMessage}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600">
                        {item.state === 'inspecting' ? (
                          <span className="inline-flex items-center gap-1.5 text-blue-700 font-medium">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Inspecting</span>
                          </span>
                        ) : item.state === 'completed' ? (
                          <span className="text-slate-700">{item.savedId ? 'Saved' : 'Evaluated'}</span>
                        ) : item.state === 'error' ? (
                          <span className="text-red-700 font-medium">Failed</span>
                        ) : (
                          <span>Queued</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        {verdict === 'PASS' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>PASS</span>
                          </span>
                        )}
                        {verdict === 'CONDITIONAL' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>CONDITIONAL</span>
                          </span>
                        )}
                        {verdict === 'FAIL' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>FAIL</span>
                          </span>
                        )}
                        {!verdict && <span className="text-slate-400">--</span>}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums text-slate-800">
                        {item.result ? `${item.result.qualityScore}/100` : '--'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums text-slate-800">
                        {item.result ? item.result.defects.length : '--'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {item.result && (
                            <button
                              type="button"
                              onClick={() => onInspectInStage(item)}
                              className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
                            >
                              Inspect Details
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              onSetItems((prev) => prev.filter((it) => it.id !== item.id))
                            }
                            aria-label={`Remove ${item.assetLabel}`}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
