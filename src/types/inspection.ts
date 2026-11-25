export type DomainProfile =
  | 'manufacturing'
  | 'logistics'
  | 'automotive'
  | 'electronics'
  | 'infrastructure';

export type ToleranceStandard = 'strict' | 'standard' | 'triage';

export type Verdict = 'PASS' | 'CONDITIONAL' | 'FAIL';

export type DefectSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export type InspectionStatus = 'open' | 'reviewed' | 'archived';

export interface DefectFinding {
  id: string;
  defectType: string;
  severity: DefectSeverity;
  confidence: number;
  locationDescription: string;
  remediation: string;
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface InspectionResult {
  verdict: Verdict;
  qualityScore: number;
  surfaceCondition: string;
  structuralIntegrity: string;
  recommendedAction: string;
  summary: string;
  defects: DefectFinding[];
}

export interface SavedInspectionRecord {
  id: string;
  ownerId: string;
  batchId: string;
  assetLabel: string;
  domainProfile: DomainProfile;
  toleranceStandard: ToleranceStandard;
  verdict: Verdict;
  aiVerdict: Verdict;
  qualityScore: number;
  surfaceCondition: string;
  structuralIntegrity: string;
  recommendedAction: string;
  summary: string;
  inspectorNotes: string;
  defectCount: number;
  criticalCount: number;
  defectsSummary: string[];
  status: InspectionStatus;
  thumbnailDataUrl?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface InspectionStandardPreset {
  id: string;
  ownerId: string;
  name: string;
  domainProfile: DomainProfile;
  toleranceStandard: ToleranceStandard;
  passThreshold: number;
  defectFocus: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SampleSpecimen {
  id: string;
  title: string;
  batchId: string;
  domainProfile: DomainProfile;
  imageUrl: string;
  description: string;
}

export interface BatchQueueItem {
  id: string;
  assetLabel: string;
  previewUrl: string;
  base64: string;
  mimeType: string;
  state: 'queued' | 'inspecting' | 'completed' | 'error';
  result?: InspectionResult;
  errorMessage?: string;
  savedId?: string;
}

export const FIELD_LIMITS = {
  batchId: 64,
  assetLabel: 120,
  surfaceCondition: 64,
  structuralIntegrity: 64,
  recommendedAction: 120,
  summary: 1000,
  inspectorNotes: 1000,
  defectSummaryItem: 240,
  defectsSummaryMax: 15,
  defectType: 80,
  locationDescription: 240,
  remediation: 400,
  standardName: 80,
  defectFocus: 500,
  thumbnailMaxChars: 200000,
} as const;
