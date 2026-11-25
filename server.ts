import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type, ThinkingLevel, type GenerateContentResponse } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

const DOMAIN_GUIDANCE: Record<string, string> = {
  manufacturing:
    'Inspect machined/manufactured industrial components for surface scratches, scoring, burrs, cracks, pitting, corrosion, dimensional deformation, and finish defects.',
  logistics:
    'Inspect shipping parcels, cartons, pallets, and freight for crushed corners, compression damage, torn seals/tape, punctures, moisture staining, and barcode/label damage.',
  automotive:
    'Inspect automotive body panels, paintwork, trim, and glass under inspection lighting for dents, dings, clearcoat scuffs, scratches, orange peel, panel gap misalignment, and paint chips.',
  electronics:
    'Inspect printed circuit boards and electronics assemblies for solder bridges, cold joints, tombstoning, missing/skewed SMD components, lifted pads, burn marks, and trace damage.',
  infrastructure:
    'Inspect structural surfaces, welds, concrete, coatings, and equipment housings for fractures, spalling, delamination, rust/corrosion, fastener failure, and seal breaches.',
};

const TOLERANCE_GUIDANCE: Record<string, string> = {
  strict:
    'Apply ISO-9001 zero-defect strictness: even minor cosmetic scratches, subtle burrs, or slight alignment shifts lower the score significantly and trigger CONDITIONAL or FAIL.',
  standard:
    'Apply standard commercial QA criteria: functional/structural integrity issues trigger FAIL; moderate cosmetic or localized surface defects trigger CONDITIONAL; intact items PASS.',
  triage:
    'Apply field triage criteria: flag severe structural damage, safety hazards, or breach of containment as FAIL; minor surface wear passes with advisories.',
};

interface InspectRequestBody {
  imageBase64?: string;
  mimeType?: string;
  domainProfile?: string;
  toleranceStandard?: string;
  assetLabel?: string;
  customFocus?: string;
  passThreshold?: number;
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured. Please verify your key in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function clampCoord(val: unknown): number {
  const num = typeof val === 'number' && Number.isFinite(val) ? Math.round(val) : 0;
  return Math.max(0, Math.min(1000, num));
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, model: MODEL_NAME });
  });

  app.post('/api/inspect', async (req: Request, res: Response) => {
    try {
      const body = req.body as InspectRequestBody;
      const rawBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
      const mimeType = typeof body.mimeType === 'string' && body.mimeType.startsWith('image/')
        ? body.mimeType
        : 'image/jpeg';
      const domainProfile = typeof body.domainProfile === 'string' && DOMAIN_GUIDANCE[body.domainProfile]
        ? body.domainProfile
        : 'manufacturing';
      const toleranceStandard =
        typeof body.toleranceStandard === 'string' && TOLERANCE_GUIDANCE[body.toleranceStandard]
          ? body.toleranceStandard
          : 'standard';
      const assetLabel = typeof body.assetLabel === 'string' ? body.assetLabel.trim().slice(0, 120) : 'Inspected Specimen';
      const customFocus = typeof body.customFocus === 'string' ? body.customFocus.trim().slice(0, 500) : '';
      const passThreshold =
        typeof body.passThreshold === 'number' && Number.isFinite(body.passThreshold)
          ? Math.max(0, Math.min(100, Math.round(body.passThreshold)))
          : toleranceStandard === 'strict'
            ? 90
            : toleranceStandard === 'triage'
              ? 65
              : 80;

      if (!rawBase64) {
        res.status(400).json({ error: 'An image payload is required for inspection.' });
        return;
      }

      const cleanedBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
      const ai = getAiClient();

      const systemInstruction = [
        'You are an expert automated visual quality assurance and damage inspection system.',
        'Analyze the provided specimen photograph objectively and precisely.',
        'Locate any genuine physical defects, damage, anomalies, or quality non-conformances.',
        'Do NOT fabricate defects if the specimen appears clean and intact; return an empty defects array and PASS if no defects exist.',
        'For every detected defect, provide accurate bounding box coordinates [ymin, xmin, ymax, xmax] normalized on a 0 to 1000 integer scale relative to the image dimensions, where (0,0) is top-left and (1000,1000) is bottom-right.',
        'Keep summary under 750 characters and all field descriptions concise and technical.',
      ].join(' ');

      const promptText = [
        `Asset Label: ${assetLabel}`,
        `Inspection Domain: ${domainProfile} — ${DOMAIN_GUIDANCE[domainProfile]}`,
        `Tolerance Standard: ${toleranceStandard} — ${TOLERANCE_GUIDANCE[toleranceStandard]}`,
        `Target Pass Score Threshold: ${passThreshold}/100`,
        customFocus ? `Additional Inspection Focus: ${customFocus}` : '',
        'Inspect the image thoroughly and return the structured JSON inspection report.',
      ]
        .filter(Boolean)
        .join('\n');

      const invokeModel = async (): Promise<GenerateContentResponse> => {
        const delays = [800, 1800];
        let lastError: unknown;
        for (let attempt = 0; attempt <= delays.length; attempt++) {
          try {
            return await ai.models.generateContent({
              model: MODEL_NAME,
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: cleanedBase64,
                    },
                  },
                  { text: promptText },
                ],
              },
              config: {
                systemInstruction,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    verdict: {
                      type: Type.STRING,
                      enum: ['PASS', 'CONDITIONAL', 'FAIL'],
                      description: 'Overall quality verdict.',
                    },
                    qualityScore: {
                      type: Type.INTEGER,
                      description: 'Overall quality score from 0 (severely damaged) to 100 (pristine).',
                    },
                    surfaceCondition: {
                      type: Type.STRING,
                      description: 'Short label for surface state, e.g. Intact, Scored, Scuffed, Torn, Corroded.',
                    },
                    structuralIntegrity: {
                      type: Type.STRING,
                      description: 'Short label for structural state, e.g. Nominal, Deformed, Crushed, Compromised.',
                    },
                    recommendedAction: {
                      type: Type.STRING,
                      description: 'Disposition recommendation such as Release to Production, Manual Secondary Review, Quarantine & Rework, or Reject & Claim.',
                    },
                    summary: {
                      type: Type.STRING,
                      description: 'Concise technical inspection findings summary.',
                    },
                    defects: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          defectType: {
                            type: Type.STRING,
                            description: 'Defect classification, e.g. Surface Scratch, Corner Crush, Dent, Edge Burr, Solder Bridge.',
                          },
                          severity: {
                            type: Type.STRING,
                            enum: ['CRITICAL', 'MAJOR', 'MINOR'],
                            description: 'Defect severity level.',
                          },
                          confidence: {
                            type: Type.NUMBER,
                            description: 'Detection confidence from 0.0 to 1.0.',
                          },
                          locationDescription: {
                            type: Type.STRING,
                            description: 'Where on the specimen the defect appears.',
                          },
                          remediation: {
                            type: Type.STRING,
                            description: 'Actionable corrective step or disposition instruction.',
                          },
                          ymin: { type: Type.INTEGER, description: 'Normalized top coordinate 0..1000.' },
                          xmin: { type: Type.INTEGER, description: 'Normalized left coordinate 0..1000.' },
                          ymax: { type: Type.INTEGER, description: 'Normalized bottom coordinate 0..1000.' },
                          xmax: { type: Type.INTEGER, description: 'Normalized right coordinate 0..1000.' },
                        },
                        required: [
                          'defectType',
                          'severity',
                          'confidence',
                          'locationDescription',
                          'remediation',
                          'ymin',
                          'xmin',
                          'ymax',
                          'xmax',
                        ],
                      },
                    },
                  },
                  required: [
                    'verdict',
                    'qualityScore',
                    'surfaceCondition',
                    'structuralIntegrity',
                    'recommendedAction',
                    'summary',
                    'defects',
                  ],
                },
              },
            });
          } catch (err: unknown) {
            lastError = err;
            const msg = err instanceof Error ? err.message : String(err);
            const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('500');
            if (!isTransient || attempt === delays.length) {
              throw err;
            }
            await new Promise((r) => setTimeout(r, delays[attempt]));
          }
        }
        throw lastError;
      };

      const response = await invokeModel();

      const text = (response.text ?? '').trim();
      if (!text) {
        res.status(502).json({ error: 'The inspection model returned an empty response.' });
        return;
      }

      const parsed = JSON.parse(text) as {
        verdict?: string;
        qualityScore?: number;
        surfaceCondition?: string;
        structuralIntegrity?: string;
        recommendedAction?: string;
        summary?: string;
        defects?: Array<{
          defectType?: string;
          severity?: string;
          confidence?: number;
          locationDescription?: string;
          remediation?: string;
          ymin?: number;
          xmin?: number;
          ymax?: number;
          xmax?: number;
        }>;
      };

      const rawDefects = Array.isArray(parsed.defects) ? parsed.defects.slice(0, 15) : [];
      const sanitizedDefects = rawDefects.map((d, idx) => {
        const ymin = clampCoord(d.ymin);
        const xmin = clampCoord(d.xmin);
        const ymax = Math.max(ymin + 10 <= 1000 ? ymin + 10 : ymin, clampCoord(d.ymax));
        const xmax = Math.max(xmin + 10 <= 1000 ? xmin + 10 : xmin, clampCoord(d.xmax));
        const severity =
          d.severity === 'CRITICAL' || d.severity === 'MAJOR' || d.severity === 'MINOR'
            ? d.severity
            : 'MINOR';
        const confidence =
          typeof d.confidence === 'number' && Number.isFinite(d.confidence)
            ? Math.max(0, Math.min(1, Number(d.confidence.toFixed(2))))
            : 0.85;

        return {
          id: `def_${idx + 1}`,
          defectType: String(d.defectType || 'Surface Anomaly').slice(0, 80),
          severity,
          confidence,
          locationDescription: String(d.locationDescription || 'Detected on specimen surface').slice(0, 240),
          remediation: String(d.remediation || 'Perform manual secondary metrology check.').slice(0, 400),
          ymin,
          xmin,
          ymax,
          xmax,
        };
      });

      const score =
        typeof parsed.qualityScore === 'number' && Number.isFinite(parsed.qualityScore)
          ? Math.max(0, Math.min(100, Math.round(parsed.qualityScore)))
          : 50;

      const verdict =
        parsed.verdict === 'PASS' || parsed.verdict === 'CONDITIONAL' || parsed.verdict === 'FAIL'
          ? parsed.verdict
          : score >= passThreshold
            ? 'PASS'
            : score >= 55
              ? 'CONDITIONAL'
              : 'FAIL';

      res.json({
        verdict,
        qualityScore: score,
        surfaceCondition: String(parsed.surfaceCondition || 'Evaluated').slice(0, 64),
        structuralIntegrity: String(parsed.structuralIntegrity || 'Evaluated').slice(0, 64),
        recommendedAction: String(parsed.recommendedAction || 'Manual Secondary Review').slice(0, 120),
        summary: String(parsed.summary || 'Automated visual inspection completed.').slice(0, 1000),
        defects: sanitizedDefects,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected inspection error.';
      console.error('Inspection API error:', err);

      if (message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID') || message.includes('403')) {
        res.status(403).json({
          error: 'Gemini API authentication failed. Please check GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }
      if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
        res.status(429).json({
          error: 'Inspection quota rate limit reached. Please retry shortly or verify billing in Settings > Secrets.',
        });
        return;
      }
      if (message.includes('NOT_FOUND') || message.includes('404')) {
        res.status(404).json({
          error: `Requested vision model (${MODEL_NAME}) was not found.`,
        });
        return;
      }
      if (message.includes('503') || message.includes('UNAVAILABLE')) {
        res.status(503).json({
          error: 'Inspection vision model is temporarily busy. Please retry in a few seconds.',
        });
        return;
      }

      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VeriSpec server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
