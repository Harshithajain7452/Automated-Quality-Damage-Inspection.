import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  FIELD_LIMITS,
  type DefectFinding,
  type DomainProfile,
  type InspectionResult,
  type InspectionStandardPreset,
  type InspectionStatus,
  type SavedInspectionRecord,
  type ToleranceStandard,
  type Verdict,
} from '../types/inspection';

function generateSafeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) {
    return ts.toMillis();
  }
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: unknown }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const displayName = (user.displayName || user.email?.split('@')[0] || 'QA Inspector').slice(0, 100);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        role: 'inspector',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (snap.data()?.displayName !== displayName) {
      await updateDoc(ref, {
        displayName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeInspections(
  uid: string,
  onData: (records: SavedInspectionRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colPath = 'inspections';
  const q = query(collection(db, colPath), where('ownerId', '==', uid), limit(150));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedInspectionRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId || uid),
          batchId: String(data.batchId || 'LOT-DEFAULT'),
          assetLabel: String(data.assetLabel || 'Specimen'),
          domainProfile: (data.domainProfile || 'manufacturing') as DomainProfile,
          toleranceStandard: (data.toleranceStandard || 'standard') as ToleranceStandard,
          verdict: (data.verdict || 'CONDITIONAL') as Verdict,
          aiVerdict: (data.aiVerdict || data.verdict || 'CONDITIONAL') as Verdict,
          qualityScore: Number(data.qualityScore ?? 0),
          surfaceCondition: String(data.surfaceCondition || 'Evaluated'),
          structuralIntegrity: String(data.structuralIntegrity || 'Evaluated'),
          recommendedAction: String(data.recommendedAction || 'Manual Review'),
          summary: String(data.summary || ''),
          inspectorNotes: String(data.inspectorNotes || ''),
          defectCount: Number(data.defectCount ?? 0),
          criticalCount: Number(data.criticalCount ?? 0),
          defectsSummary: Array.isArray(data.defectsSummary)
            ? data.defectsSummary.map((s) => String(s))
            : [],
          status: (data.status || 'open') as InspectionStatus,
          thumbnailDataUrl: typeof data.thumbnailDataUrl === 'string' ? data.thumbnailDataUrl : undefined,
          createdAtMs: toMillis(data.createdAt),
          updatedAtMs: toMillis(data.updatedAt),
        };
      });

      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, colPath);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export interface SaveInspectionInput {
  ownerId: string;
  batchId: string;
  assetLabel: string;
  domainProfile: DomainProfile;
  toleranceStandard: ToleranceStandard;
  result: InspectionResult;
  verdictOverride?: Verdict;
  inspectorNotes?: string;
  thumbnailDataUrl?: string;
}

export async function saveInspectionWithFindings(input: SaveInspectionInput): Promise<string> {
  const inspectionId = generateSafeId('insp');
  const inspectionPath = `inspections/${inspectionId}`;

  const defects = input.result.defects.slice(0, FIELD_LIMITS.defectsSummaryMax);
  const criticalCount = defects.filter((d) => d.severity === 'CRITICAL').length;
  const defectsSummary = defects.map((d) =>
    `${d.severity}: ${d.defectType} (${d.locationDescription})`.slice(0, FIELD_LIMITS.defectSummaryItem)
  );

  const effectiveVerdict = input.verdictOverride || input.result.verdict;
  const sanitizedNotes = (input.inspectorNotes || '').trim().slice(0, FIELD_LIMITS.inspectorNotes);

  const payload: Record<string, unknown> = {
    ownerId: input.ownerId,
    batchId: (input.batchId.trim() || 'LOT-2026').slice(0, FIELD_LIMITS.batchId),
    assetLabel: (input.assetLabel.trim() || 'Inspected Specimen').slice(0, FIELD_LIMITS.assetLabel),
    domainProfile: input.domainProfile,
    toleranceStandard: input.toleranceStandard,
    verdict: effectiveVerdict,
    aiVerdict: input.result.verdict,
    qualityScore: Math.max(0, Math.min(100, Math.round(input.result.qualityScore))),
    surfaceCondition: (input.result.surfaceCondition || 'Evaluated').slice(0, FIELD_LIMITS.surfaceCondition),
    structuralIntegrity: (input.result.structuralIntegrity || 'Evaluated').slice(0, FIELD_LIMITS.structuralIntegrity),
    recommendedAction: (input.result.recommendedAction || 'Manual Review').slice(0, FIELD_LIMITS.recommendedAction),
    summary: (input.result.summary || 'Inspection complete.').slice(0, FIELD_LIMITS.summary),
    inspectorNotes: sanitizedNotes,
    defectCount: defects.length,
    criticalCount,
    defectsSummary,
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (input.thumbnailDataUrl && input.thumbnailDataUrl.length <= FIELD_LIMITS.thumbnailMaxChars) {
    payload.thumbnailDataUrl = input.thumbnailDataUrl;
  }

  try {
    const batch = writeBatch(db);
    const inspRef = doc(db, 'inspections', inspectionId);
    batch.set(inspRef, payload);

    defects.forEach((d, idx) => {
      const findingId = generateSafeId(`f${idx}`);
      const findingRef = doc(db, 'inspections', inspectionId, 'findings', findingId);
      batch.set(findingRef, {
        ownerId: input.ownerId,
        inspectionId,
        defectType: d.defectType.slice(0, FIELD_LIMITS.defectType),
        severity: d.severity,
        confidence: Math.max(0, Math.min(1, Number(d.confidence.toFixed(2)))),
        locationDescription: d.locationDescription.slice(0, FIELD_LIMITS.locationDescription),
        remediation: d.remediation.slice(0, FIELD_LIMITS.remediation),
        ymin: Math.max(0, Math.min(1000, Math.round(d.ymin))),
        xmin: Math.max(0, Math.min(1000, Math.round(d.xmin))),
        ymax: Math.max(0, Math.min(1000, Math.round(d.ymax))),
        xmax: Math.max(0, Math.min(1000, Math.round(d.xmax))),
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
    return inspectionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, inspectionPath);
  }
}

export async function fetchInspectionFindings(
  inspectionId: string,
  ownerId: string
): Promise<DefectFinding[]> {
  const path = `inspections/${inspectionId}/findings`;
  try {
    const q = query(
      collection(db, 'inspections', inspectionId, 'findings'),
      where('ownerId', '==', ownerId),
      where('inspectionId', '==', inspectionId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        defectType: String(data.defectType || 'Defect'),
        severity: (data.severity || 'MINOR') as DefectFinding['severity'],
        confidence: Number(data.confidence ?? 0.8),
        locationDescription: String(data.locationDescription || ''),
        remediation: String(data.remediation || ''),
        ymin: Number(data.ymin ?? 0),
        xmin: Number(data.xmin ?? 0),
        ymax: Number(data.ymax ?? 0),
        xmax: Number(data.xmax ?? 0),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateInspectionReview(
  inspectionId: string,
  verdict: Verdict,
  inspectorNotes: string,
  status: InspectionStatus
): Promise<void> {
  const path = `inspections/${inspectionId}`;
  try {
    await updateDoc(doc(db, 'inspections', inspectionId), {
      verdict,
      inspectorNotes: inspectorNotes.trim().slice(0, FIELD_LIMITS.inspectorNotes),
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function archiveInspection(inspectionId: string): Promise<void> {
  const path = `inspections/${inspectionId}`;
  try {
    await updateDoc(doc(db, 'inspections', inspectionId), {
      status: 'archived',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteInspectionRecord(inspectionId: string): Promise<void> {
  const path = `inspections/${inspectionId}`;
  try {
    await deleteDoc(doc(db, 'inspections', inspectionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeStandards(
  uid: string,
  onData: (standards: InspectionStandardPreset[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colPath = 'standards';
  const q = query(collection(db, colPath), where('ownerId', '==', uid), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: InspectionStandardPreset[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId || uid),
          name: String(data.name || 'Custom Standard'),
          domainProfile: (data.domainProfile || 'manufacturing') as DomainProfile,
          toleranceStandard: (data.toleranceStandard || 'standard') as ToleranceStandard,
          passThreshold: Number(data.passThreshold ?? 80),
          defectFocus: String(data.defectFocus || ''),
          createdAtMs: toMillis(data.createdAt),
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, colPath);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function createStandardPreset(input: {
  ownerId: string;
  name: string;
  domainProfile: DomainProfile;
  toleranceStandard: ToleranceStandard;
  passThreshold: number;
  defectFocus: string;
}): Promise<string> {
  const standardId = generateSafeId('std');
  const path = `standards/${standardId}`;
  try {
    await setDoc(doc(db, 'standards', standardId), {
      ownerId: input.ownerId,
      name: input.name.trim().slice(0, FIELD_LIMITS.standardName),
      domainProfile: input.domainProfile,
      toleranceStandard: input.toleranceStandard,
      passThreshold: Math.max(0, Math.min(100, Math.round(input.passThreshold))),
      defectFocus: input.defectFocus.trim().slice(0, FIELD_LIMITS.defectFocus),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return standardId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteStandardPreset(standardId: string): Promise<void> {
  const path = `standards/${standardId}`;
  try {
    await deleteDoc(doc(db, 'standards', standardId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
