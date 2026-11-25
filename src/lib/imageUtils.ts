import { FIELD_LIMITS, type InspectionResult, type SavedInspectionRecord } from '../types/inspection';

export interface EncodedImagePayload {
  base64: string;
  mimeType: string;
  dataUrl: string;
}

export function readFileAsEncodedImage(file: File): Promise<EncodedImagePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl || !dataUrl.includes(',')) {
        reject(new Error('Failed to decode image file.'));
        return;
      }
      const [header, base64] = dataUrl.split(',');
      const mimeMatch = header.match(/data:(image\/[^;]+);base64/);
      resolve({
        base64,
        mimeType: mimeMatch?.[1] || file.type || 'image/jpeg',
        dataUrl,
      });
    };
    reader.onerror = () => reject(new Error('Unable to read selected image file.'));
    reader.readAsDataURL(file);
  });
}

export async function fetchImageUrlAsEncodedImage(imageUrl: string): Promise<EncodedImagePayload> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Unable to load specimen image (${response.status}).`);
  }
  const blob = await response.blob();
  const mimeType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl || !dataUrl.includes(',')) {
        reject(new Error('Failed to encode specimen image.'));
        return;
      }
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType, dataUrl });
    };
    reader.onerror = () => reject(new Error('Failed to convert specimen image.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Generates a compact JPEG thumbnail data URL (<= 140KB) safe for Firestore storage.
 */
export function createCompressedThumbnail(sourceUrl: string, maxWidth = 420): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.68);
        resolve(compressed.length <= FIELD_LIMITS.thumbnailMaxChars ? compressed : '');
      } catch {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = sourceUrl;
  });
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportInspectionsCsv(records: SavedInspectionRecord[]): void {
  const headers = [
    'Inspection ID',
    'Batch ID',
    'Asset Label',
    'Domain',
    'Tolerance',
    'Verdict',
    'AI Verdict',
    'Quality Score',
    'Defects Count',
    'Critical Defects',
    'Surface Condition',
    'Structural Integrity',
    'Recommended Action',
    'Status',
    'Timestamp',
  ];

  const rows = records.map((rec) => [
    rec.id,
    rec.batchId,
    rec.assetLabel,
    rec.domainProfile,
    rec.toleranceStandard,
    rec.verdict,
    rec.aiVerdict,
    rec.qualityScore,
    rec.defectCount,
    rec.criticalCount,
    rec.surfaceCondition,
    rec.structuralIntegrity,
    rec.recommendedAction,
    rec.status,
    new Date(rec.createdAtMs).toISOString(),
  ]);

  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `verispec-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportSingleInspectionJson(
  assetLabel: string,
  batchId: string,
  result: InspectionResult
): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    batchId,
    assetLabel,
    ...result,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${batchId.toLowerCase().replace(/[^a-z0-9-_]/g, '-')}-inspection.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
