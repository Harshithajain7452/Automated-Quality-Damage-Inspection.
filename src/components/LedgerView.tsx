import { useMemo, useState } from 'react';
import {
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Archive,
  Trash2,
  X,
  LogIn,
  Loader2,
} from 'lucide-react';
import {
  archiveInspection,
  deleteInspectionRecord,
  fetchInspectionFindings,
  updateInspectionReview,
} from '../lib/firestoreService';
import { exportInspectionsCsv } from '../lib/imageUtils';
import type {
  DefectFinding,
  SavedInspectionRecord,
  Verdict,
} from '../types/inspection';

interface LedgerViewProps {
  records: SavedInspectionRecord[];
  loading: boolean;
  isSignedIn: boolean;
  onSignIn: () => void;
  onGoToInspect: () => void;
  userId: string | null;
}

export function LedgerView({
  records,
  loading,
  isSignedIn,
  onSignIn,
  onGoToInspect,
  userId,
}: LedgerViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<'ALL' | Verdict>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<SavedInspectionRecord | null>(null);
  const [selectedFindings, setSelectedFindings] = useState<DefectFinding[]>([]);
  const [findingsLoading, setFindingsLoading] = useState(false);

  const [editVerdict, setEditVerdict] = useState<Verdict>('PASS');
  const [editNotes, setEditNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((rec) => {
      if (verdictFilter !== 'ALL' && rec.verdict !== verdictFilter) return false;
      if (!q) return true;
      return (
        rec.assetLabel.toLowerCase().includes(q) ||
        rec.batchId.toLowerCase().includes(q) ||
        rec.domainProfile.toLowerCase().includes(q)
      );
    });
  }, [records, searchQuery, verdictFilter]);

  const kpis = useMemo(() => {
    const total = records.length;
    const passed = records.filter((r) => r.verdict === 'PASS').length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const criticalDefects = records.reduce((acc, r) => acc + r.criticalCount, 0);
    const pendingReview = records.filter((r) => r.status === 'open').length;
    return { total, passRate, criticalDefects, pendingReview };
  }, [records]);

  const openRecordDrawer = async (rec: SavedInspectionRecord) => {
    setSelectedRecord(rec);
    setEditVerdict(rec.verdict);
    setEditNotes(rec.inspectorNotes);
    setDrawerError(null);
    setSelectedFindings([]);
    if (!userId) return;

    setFindingsLoading(true);
    try {
      const items = await fetchInspectionFindings(rec.id, userId);
      setSelectedFindings(items);
    } catch (err) {
      setDrawerError(err instanceof Error ? err.message : 'Unable to load defect coordinates.');
    } finally {
      setFindingsLoading(false);
    }
  };

  const handleSaveReview = async () => {
    if (!selectedRecord) return;
    setIsUpdating(true);
    setDrawerError(null);
    try {
      await updateInspectionReview(selectedRecord.id, editVerdict, editNotes, 'reviewed');
      setSelectedRecord((prev) =>
        prev ? { ...prev, verdict: editVerdict, inspectorNotes: editNotes, status: 'reviewed' } : null
      );
    } catch (err) {
      setDrawerError(err instanceof Error ? err.message : 'Failed to update inspection.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedRecord) return;
    setIsUpdating(true);
    setDrawerError(null);
    try {
      await archiveInspection(selectedRecord.id);
      setSelectedRecord((prev) => (prev ? { ...prev, status: 'archived' } : null));
    } catch (err) {
      setDrawerError(err instanceof Error ? err.message : 'Failed to archive inspection.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsUpdating(true);
    try {
      await deleteInspectionRecord(id);
      setSelectedRecord(null);
    } catch (err) {
      setDrawerError(err instanceof Error ? err.message : 'Failed to delete inspection.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center max-w-lg mx-auto space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Sign In to Access Audit Ledger</h2>
        <p className="text-sm text-slate-600">
          Your inspection records, bounding-box findings, and QA sign-offs are stored securely in your private Firestore ledger.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In with Google</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4-Column Flat KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500">Total Inspected</p>
          <p className="font-mono text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
            {kpis.total}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500">Pass Rate</p>
          <p className="font-mono text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
            {kpis.passRate}%
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500">Critical Defects</p>
          <p className="font-mono text-2xl font-semibold text-red-700 mt-1 tabular-nums">
            {kpis.criticalDefects}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500">Open Reviews</p>
          <p className="font-mono text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
            {kpis.pendingReview}
          </p>
        </div>
      </div>

      {/* Filters & Export */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search asset, lot ID, or domain..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {(['ALL', 'PASS', 'CONDITIONAL', 'FAIL'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setVerdictFilter(tab)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors whitespace-nowrap ${
                    verdictFilter === tab
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab === 'ALL' ? 'All' : tab}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => exportInspectionsCsv(filtered)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-45 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-4 space-y-2.5">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-10 bg-slate-100 rounded-sm animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900">
              {records.length === 0 ? 'No Saved Inspections Yet' : 'No Matching Records'}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {records.length === 0
                ? 'Run an automated inspection in Live Inspection and save it to begin tracking quality metrics.'
                : 'Adjust your search term or verdict filter to locate inspection logs.'}
            </p>
            {records.length === 0 && (
              <button
                type="button"
                onClick={onGoToInspect}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Inspect First Specimen
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Asset / Batch</th>
                  <th className="py-2.5 px-4">Domain</th>
                  <th className="py-2.5 px-4">Verdict</th>
                  <th className="py-2.5 px-4 text-right">Score</th>
                  <th className="py-2.5 px-4 text-right">Defects</th>
                  <th className="py-2.5 px-4">Review State</th>
                  <th className="py-2.5 px-4 text-right">Logged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filtered.map((rec) => (
                  <tr
                    key={rec.id}
                    onClick={() => void openRecordDrawer(rec)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors h-11"
                  >
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-3">
                        {rec.thumbnailDataUrl ? (
                          <img
                            src={rec.thumbnailDataUrl}
                            alt={rec.assetLabel}
                            referrerPolicy="no-referrer"
                            className="w-9 h-7 object-cover rounded-xs border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-7 bg-slate-100 border border-slate-200 rounded-xs shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate max-w-[200px]">
                            {rec.assetLabel}
                          </p>
                          <p className="font-mono text-[11px] text-slate-500 truncate">
                            {rec.batchId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-4 capitalize text-slate-600">
                      {rec.domainProfile} · {rec.toleranceStandard}
                    </td>
                    <td className="py-2 px-4">
                      {rec.verdict === 'PASS' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>PASS</span>
                        </span>
                      )}
                      {rec.verdict === 'CONDITIONAL' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>CONDITIONAL</span>
                        </span>
                      )}
                      {rec.verdict === 'FAIL' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>FAIL</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                      {rec.qualityScore}/100
                    </td>
                    <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-700">
                      {rec.defectCount}
                    </td>
                    <td className="py-2 px-4 capitalize text-slate-600">{rec.status}</td>
                    <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {new Date(rec.createdAtMs).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspection Detail Drawer */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50">
          <div className="bg-white w-full max-w-lg h-full border-l border-slate-200 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 truncate">
                  {selectedRecord.assetLabel}
                </h3>
                <p className="text-xs font-mono text-slate-500 truncate">
                  {selectedRecord.batchId} · {selectedRecord.domainProfile}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                aria-label="Close inspection detail"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {selectedRecord.thumbnailDataUrl && (
                <div className="relative bg-slate-950 rounded-md overflow-hidden flex justify-center">
                  <div className="relative inline-block">
                    <img
                      src={selectedRecord.thumbnailDataUrl}
                      alt={selectedRecord.assetLabel}
                      referrerPolicy="no-referrer"
                      className="block max-h-60 w-auto object-contain"
                    />
                    {selectedFindings.map((f, idx) => (
                      <div
                        key={f.id}
                        style={{
                          top: `${f.ymin / 10}%`,
                          left: `${f.xmin / 10}%`,
                          width: `${Math.max(2, (f.xmax - f.xmin) / 10)}%`,
                          height: `${Math.max(2, (f.ymax - f.ymin) / 10)}%`,
                        }}
                        className="absolute border-2 border-red-500 bg-red-500/10 pointer-events-none"
                      >
                        <span className="absolute -top-4 left-0 bg-red-600 text-white font-mono text-[9px] px-1 leading-tight">
                          #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Score: <strong className="font-mono text-slate-900">{selectedRecord.qualityScore}/100</strong>
                  </span>
                  <span>
                    AI Verdict: <strong className="font-mono text-slate-900">{selectedRecord.aiVerdict}</strong>
                  </span>
                  <span className="capitalize">Status: {selectedRecord.status}</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{selectedRecord.summary}</p>
                <p className="text-xs text-slate-600">
                  <strong>Action:</strong> {selectedRecord.recommendedAction}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-800">Recorded Defect Findings</h4>
                {findingsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading localized coordinates...</span>
                  </div>
                ) : selectedFindings.length === 0 ? (
                  <p className="text-xs text-slate-500">No localized defects stored for this record.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedFindings.map((f, idx) => (
                      <div key={f.id} className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1">
                        <div className="flex items-center justify-between font-semibold text-slate-900">
                          <span>
                            #{idx + 1} {f.defectType}
                          </span>
                          <span className="font-mono">{f.severity}</span>
                        </div>
                        <p className="text-slate-600">{f.locationDescription}</p>
                        <p className="text-slate-500">Remediation: {f.remediation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Update Review / Archive */}
              {selectedRecord.status !== 'archived' ? (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-800">QA Review Sign-Off</h4>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-md">
                    {(['PASS', 'CONDITIONAL', 'FAIL'] as Verdict[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setEditVerdict(v)}
                        className={`py-1.5 text-xs font-medium rounded-sm transition-colors ${
                          editVerdict === v ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    maxLength={1000}
                    placeholder="Add QA disposition notes..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  />
                  {drawerError && (
                    <p className="text-xs text-red-600">{drawerError}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveReview}
                      disabled={isUpdating}
                      className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors"
                    >
                      {isUpdating ? 'Updating...' : 'Save QA Sign-Off'}
                    </button>
                    <button
                      type="button"
                      onClick={handleArchive}
                      disabled={isUpdating}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Archive</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
                  This record is archived and locked against further verdict modifications.
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <button
                type="button"
                onClick={() => void handleDelete(selectedRecord.id)}
                disabled={isUpdating}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Record</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
