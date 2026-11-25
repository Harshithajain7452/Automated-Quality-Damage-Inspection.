import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { SAMPLE_SPECIMENS, TOLERANCE_STANDARDS } from './data/specimens';
import { auth, signInWithGoogle, signOutInspector } from './lib/firebase';
import {
  ensureUserProfile,
  saveInspectionWithFindings,
  subscribeInspections,
  subscribeStandards,
} from './lib/firestoreService';
import {
  createCompressedThumbnail,
  exportInspectionsCsv,
  exportSingleInspectionJson,
  fetchImageUrlAsEncodedImage,
  readFileAsEncodedImage,
} from './lib/imageUtils';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar, type WorkspaceView } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { InspectionViewport } from './components/InspectionViewport';
import { FindingsPanel } from './components/FindingsPanel';
import { BatchQueueView } from './components/BatchQueueView';
import { LedgerView } from './components/LedgerView';
import { StandardsView } from './components/StandardsView';
import type {
  BatchQueueItem,
  DomainProfile,
  InspectionResult,
  InspectionStandardPreset,
  SampleSpecimen,
  SavedInspectionRecord,
  ToleranceStandard,
  Verdict,
} from './types/inspection';

function WorkspaceApp() {
  const [activeView, setActiveView] = useState<WorkspaceView>('inspect');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Firebase Auth & Firestore state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [savedInspections, setSavedInspections] = useState<SavedInspectionRecord[]>([]);
  const [inspectionsLoading, setInspectionsLoading] = useState(false);
  const [customStandards, setCustomStandards] = useState<InspectionStandardPreset[]>([]);

  // Live Inspection State (preloaded with first sample specimen)
  const initialSpec = SAMPLE_SPECIMENS[0];
  const [activeSpecimenId, setActiveSpecimenId] = useState<string | null>(initialSpec.id);
  const [imageUrl, setImageUrl] = useState<string | null>(initialSpec.imageUrl);
  const [encodedImage, setEncodedImage] = useState<{ base64: string; mimeType: string } | null>(null);

  const [assetLabel, setAssetLabel] = useState(initialSpec.title);
  const [batchId, setBatchId] = useState(initialSpec.batchId);
  const [domainProfile, setDomainProfile] = useState<DomainProfile>(initialSpec.domainProfile);
  const [toleranceStandard, setToleranceStandard] = useState<ToleranceStandard>('standard');
  const [passThreshold, setPassThreshold] = useState<number>(80);
  const [customFocus, setCustomFocus] = useState('');

  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(null);
  const [verdictOverride, setVerdictOverride] = useState<Verdict | null>(null);
  const [inspectorNotes, setInspectorNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);

  // Batch Queue State
  const [batchItems, setBatchItems] = useState<BatchQueueItem[]>([]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        void ensureUserProfile(nextUser).catch((err) => {
          console.error('Profile sync error:', err);
        });
      }
    });
    return () => unsub();
  }, []);

  // Firestore listeners (active only when authenticated)
  useEffect(() => {
    if (!authReady || !user) {
      setSavedInspections([]);
      setCustomStandards([]);
      setInspectionsLoading(false);
      return;
    }

    setInspectionsLoading(true);
    const unsubInspections = subscribeInspections(
      user.uid,
      (records) => {
        setSavedInspections(records);
        setInspectionsLoading(false);
      },
      () => {
        setInspectionsLoading(false);
      }
    );

    const unsubStandards = subscribeStandards(user.uid, (items) => {
      setCustomStandards(items);
    });

    return () => {
      unsubInspections();
      unsubStandards();
    };
  }, [authReady, user]);

  // Pre-encode initial specimen on mount
  useEffect(() => {
    let cancelled = false;
    fetchImageUrlAsEncodedImage(initialSpec.imageUrl)
      .then((encoded) => {
        if (!cancelled) {
          setEncodedImage({ base64: encoded.base64, mimeType: encoded.mimeType });
        }
      })
      .catch(() => {
        // Handled lazily on inspect click if needed
      });
    return () => {
      cancelled = true;
    };
  }, [initialSpec.imageUrl]);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    }
  };

  const handleSignOut = async () => {
    await signOutInspector();
  };

  const resetActiveFindings = () => {
    setResult(null);
    setSelectedDefectId(null);
    setVerdictOverride(null);
    setInspectorNotes('');
    setSavedRecordId(null);
    setInspectionError(null);
  };

  const handleSelectSpecimen = async (spec: SampleSpecimen) => {
    resetActiveFindings();
    setActiveSpecimenId(spec.id);
    setImageUrl(spec.imageUrl);
    setAssetLabel(spec.title);
    setBatchId(spec.batchId);
    setDomainProfile(spec.domainProfile);
    setEncodedImage(null);
    try {
      const encoded = await fetchImageUrlAsEncodedImage(spec.imageUrl);
      setEncodedImage({ base64: encoded.base64, mimeType: encoded.mimeType });
    } catch (err) {
      setInspectionError(err instanceof Error ? err.message : 'Unable to load specimen image.');
    }
  };

  const handleUploadFile = async (file: File) => {
    resetActiveFindings();
    setActiveSpecimenId(null);
    try {
      const encoded = await readFileAsEncodedImage(file);
      setImageUrl(encoded.dataUrl);
      setEncodedImage({ base64: encoded.base64, mimeType: encoded.mimeType });
      setAssetLabel(file.name.replace(/\.[^.]+$/, ''));
      setBatchId(`LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
    } catch (err) {
      setInspectionError(err instanceof Error ? err.message : 'Failed to process uploaded photo.');
    }
  };

  const handleCaptureDataUrl = (dataUrl: string) => {
    resetActiveFindings();
    setActiveSpecimenId(null);
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    setImageUrl(dataUrl);
    setEncodedImage({ base64, mimeType: 'image/jpeg' });
    setAssetLabel(`Camera Capture ${new Date().toLocaleTimeString()}`);
    setBatchId(`CAM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
  };

  const handleRunInspection = async () => {
    if (!imageUrl || isInspecting) return;
    setIsInspecting(true);
    setInspectionError(null);
    setSelectedDefectId(null);
    setSavedRecordId(null);

    try {
      let payload = encodedImage;
      if (!payload) {
        const fetched = await fetchImageUrlAsEncodedImage(imageUrl);
        payload = { base64: fetched.base64, mimeType: fetched.mimeType };
        setEncodedImage(payload);
      }

      const response = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: payload.base64,
          mimeType: payload.mimeType,
          domainProfile,
          toleranceStandard,
          assetLabel,
          customFocus,
          passThreshold,
        }),
      });

      const data = (await response.json()) as InspectionResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || `Inspection request failed (${response.status})`);
      }

      setResult(data);
      setVerdictOverride(data.verdict);
    } catch (err) {
      setInspectionError(err instanceof Error ? err.message : 'Automated inspection failed.');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleSaveToLedger = async () => {
    if (!result || isSaving || savedRecordId) return;
    if (!user) {
      await handleSignIn();
      return;
    }

    setIsSaving(true);
    setInspectionError(null);
    try {
      const thumbnailDataUrl = imageUrl ? await createCompressedThumbnail(imageUrl) : '';
      const id = await saveInspectionWithFindings({
        ownerId: user.uid,
        batchId,
        assetLabel,
        domainProfile,
        toleranceStandard,
        result,
        verdictOverride: verdictOverride || result.verdict,
        inspectorNotes,
        thumbnailDataUrl,
      });
      setSavedRecordId(id);
    } catch (err) {
      setInspectionError(err instanceof Error ? err.message : 'Unable to save record to Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBatchItem = async (
    item: BatchQueueItem,
    qBatchId: string,
    qDomain: DomainProfile,
    qTolerance: ToleranceStandard
  ): Promise<string | null> => {
    if (!user || !item.result) return null;
    const thumbnailDataUrl = await createCompressedThumbnail(item.previewUrl);
    return saveInspectionWithFindings({
      ownerId: user.uid,
      batchId: qBatchId,
      assetLabel: item.assetLabel,
      domainProfile: qDomain,
      toleranceStandard: qTolerance,
      result: item.result,
      thumbnailDataUrl,
    });
  };

  const handleInspectBatchItemInStage = (item: BatchQueueItem) => {
    if (!item.result) return;
    setActiveSpecimenId(null);
    setImageUrl(item.previewUrl);
    setEncodedImage({ base64: item.base64, mimeType: item.mimeType });
    setAssetLabel(item.assetLabel);
    setResult(item.result);
    setVerdictOverride(item.result.verdict);
    setSelectedDefectId(item.result.defects[0]?.id || null);
    setSavedRecordId(item.savedId || null);
    setActiveView('inspect');
  };

  const handleApplyStandard = (std: InspectionStandardPreset) => {
    setDomainProfile(std.domainProfile);
    setToleranceStandard(std.toleranceStandard);
    setPassThreshold(std.passThreshold);
    setCustomFocus(std.defectFocus);
    setActiveView('inspect');
  };

  const topBarAction = (() => {
    if (activeView === 'inspect') {
      return {
        label: isInspecting ? 'Inspecting...' : 'Run Inspection',
        onClick: () => void handleRunInspection(),
        disabled: !imageUrl || isInspecting,
      };
    }
    if (activeView === 'batch') {
      return {
        label: 'New Inspection',
        onClick: () => setActiveView('inspect'),
        disabled: false,
      };
    }
    if (activeView === 'ledger') {
      return {
        label: 'Download CSV',
        onClick: () => exportInspectionsCsv(savedInspections),
        disabled: savedInspections.length === 0,
      };
    }
    return {
      label: 'Live Inspection',
      onClick: () => setActiveView('inspect'),
      disabled: false,
    };
  })();

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        user={user}
        authReady={authReady}
        onSignIn={() => void handleSignIn()}
        onSignOut={() => void handleSignOut()}
        savedCount={savedInspections.length}
        batchCount={batchItems.length}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeView={activeView}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          primaryActionLabel={topBarAction.label}
          onPrimaryAction={topBarAction.onClick}
          primaryActionDisabled={topBarAction.disabled}
        />

        {authError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
            {authError}
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeView === 'inspect' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <div className="xl:col-span-7">
                <InspectionViewport
                  imageUrl={imageUrl}
                  assetLabel={assetLabel}
                  defects={result?.defects || []}
                  selectedDefectId={selectedDefectId}
                  onSelectDefect={setSelectedDefectId}
                  isInspecting={isInspecting}
                  onUploadFile={(file) => void handleUploadFile(file)}
                  onSelectSpecimen={(spec) => void handleSelectSpecimen(spec)}
                  onCaptureDataUrl={handleCaptureDataUrl}
                  activeSpecimenId={activeSpecimenId}
                />
              </div>

              <div className="xl:col-span-5">
                <FindingsPanel
                  assetLabel={assetLabel}
                  onAssetLabelChange={setAssetLabel}
                  batchId={batchId}
                  onBatchIdChange={setBatchId}
                  domainProfile={domainProfile}
                  onDomainProfileChange={setDomainProfile}
                  toleranceStandard={toleranceStandard}
                  onToleranceStandardChange={(next) => {
                    setToleranceStandard(next);
                    const found = TOLERANCE_STANDARDS.find((t) => t.id === next);
                    if (found) setPassThreshold(found.threshold);
                  }}
                  customFocus={customFocus}
                  onCustomFocusChange={setCustomFocus}
                  customStandards={customStandards}
                  onApplyPreset={handleApplyStandard}
                  onRunInspection={() => void handleRunInspection()}
                  isInspecting={isInspecting}
                  canRunInspection={Boolean(imageUrl)}
                  inspectionError={inspectionError}
                  result={result}
                  selectedDefectId={selectedDefectId}
                  onSelectDefect={setSelectedDefectId}
                  verdictOverride={verdictOverride}
                  onVerdictOverrideChange={setVerdictOverride}
                  inspectorNotes={inspectorNotes}
                  onInspectorNotesChange={setInspectorNotes}
                  onSaveToLedger={() => void handleSaveToLedger()}
                  isSaving={isSaving}
                  savedRecordId={savedRecordId}
                  onExportJson={() =>
                    result && exportSingleInspectionJson(assetLabel, batchId, result)
                  }
                  isSignedIn={Boolean(user)}
                />
              </div>
            </div>
          )}

          {activeView === 'batch' && (
            <BatchQueueView
              items={batchItems}
              onSetItems={setBatchItems}
              onSaveBatchItem={handleSaveBatchItem}
              isSignedIn={Boolean(user)}
              onRequestSignIn={() => void handleSignIn()}
              onInspectInStage={handleInspectBatchItemInStage}
            />
          )}

          {activeView === 'ledger' && (
            <LedgerView
              records={savedInspections}
              loading={inspectionsLoading}
              isSignedIn={Boolean(user)}
              onSignIn={() => void handleSignIn()}
              onGoToInspect={() => setActiveView('inspect')}
              userId={user?.uid || null}
            />
          )}

          {activeView === 'standards' && (
            <StandardsView
              standards={customStandards}
              isSignedIn={Boolean(user)}
              userId={user?.uid || null}
              onSignIn={() => void handleSignIn()}
              onApplyStandard={handleApplyStandard}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceApp />
    </ErrorBoundary>
  );
}
