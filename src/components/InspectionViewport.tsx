import { useRef, useState, useEffect, type DragEvent } from 'react';
import {
  Upload,
  Camera,
  Eye,
  EyeOff,
  ZoomIn,
  Image as ImageIcon,
  X,
  Aperture,
  ScanSearch,
} from 'lucide-react';
import { SAMPLE_SPECIMENS } from '../data/specimens';
import type { DefectFinding, SampleSpecimen } from '../types/inspection';

interface InspectionViewportProps {
  imageUrl: string | null;
  assetLabel: string;
  defects: DefectFinding[];
  selectedDefectId: string | null;
  onSelectDefect: (id: string | null) => void;
  isInspecting: boolean;
  onUploadFile: (file: File) => void;
  onSelectSpecimen: (specimen: SampleSpecimen) => void;
  onCaptureDataUrl: (dataUrl: string) => void;
  activeSpecimenId: string | null;
}

const SEVERITY_BOX_CLASSES: Record<DefectFinding['severity'], string> = {
  CRITICAL: 'border-red-600 bg-red-600/12',
  MAJOR: 'border-amber-600 bg-amber-600/12',
  MINOR: 'border-blue-600 bg-blue-600/12',
};

const SEVERITY_TAG_CLASSES: Record<DefectFinding['severity'], string> = {
  CRITICAL: 'bg-red-600 text-white',
  MAJOR: 'bg-amber-600 text-white',
  MINOR: 'bg-blue-600 text-white',
};

export function InspectionViewport({
  imageUrl,
  assetLabel,
  defects,
  selectedDefectId,
  onSelectDefect,
  isInspecting,
  onUploadFile,
  onSelectSpecimen,
  onCaptureDataUrl,
  activeSpecimenId,
}: InspectionViewportProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [showOverlays, setShowOverlays] = useState(true);
  const [zoom, setZoom] = useState<1 | 1.5 | 2>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const openCamera = async () => {
    setCameraError(null);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError('Camera access is unavailable or was denied in this browser.');
    }
  };

  const handleSnapPhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    onCaptureDataUrl(dataUrl);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onUploadFile(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onUploadFile(file);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Photo</span>
            </button>
            <button
              type="button"
              onClick={openCamera}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Use Camera</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOverlays((prev) => !prev)}
              disabled={defects.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-45 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              {showOverlays ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{showOverlays ? 'Hide Boxes' : 'Show Boxes'}</span>
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => (z === 1 ? 1.5 : z === 1.5 ? 2 : 1))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>{Math.round(zoom * 100)}%</span>
            </button>
          </div>
        </div>

        {/* Optical Inspection Stage */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative bg-slate-950 min-h-[340px] sm:min-h-[440px] flex items-center justify-center p-4 overflow-auto transition-colors ${
            isDragging ? 'ring-2 ring-inset ring-blue-500 bg-slate-900' : ''
          }`}
        >
          {imageUrl && !imageError ? (
            <div
              className="relative inline-block transition-transform duration-150 ease-out origin-center"
              style={{ transform: `scale(${zoom})` }}
            >
              <img
                src={imageUrl}
                alt={assetLabel || 'Inspection specimen'}
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="block max-h-[480px] w-auto max-w-full object-contain rounded-sm select-none"
              />

              {/* Bounding box overlay mapped 1:1 to image dimensions */}
              {showOverlays &&
                defects.map((defect, index) => {
                  const top = `${defect.ymin / 10}%`;
                  const left = `${defect.xmin / 10}%`;
                  const height = `${Math.max(2, (defect.ymax - defect.ymin) / 10)}%`;
                  const width = `${Math.max(2, (defect.xmax - defect.xmin) / 10)}%`;
                  const isSelected = selectedDefectId === defect.id;

                  return (
                    <button
                      key={defect.id}
                      type="button"
                      onClick={() => onSelectDefect(isSelected ? null : defect.id)}
                      aria-label={`Defect ${index + 1}: ${defect.defectType}`}
                      style={{ top, left, width, height }}
                      className={`absolute border-2 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        SEVERITY_BOX_CLASSES[defect.severity]
                      } ${
                        selectedDefectId && !isSelected ? 'opacity-45 hover:opacity-90' : 'opacity-100'
                      } ${isSelected ? 'ring-2 ring-white shadow-sm' : ''}`}
                    >
                      <span
                        className={`absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-mono font-semibold leading-none whitespace-nowrap rounded-xs tabular-nums ${
                          SEVERITY_TAG_CLASSES[defect.severity]
                        }`}
                      >
                        #{index + 1} {defect.defectType}
                      </span>
                    </button>
                  );
                })}
            </div>
          ) : (
            <div className="text-center max-w-sm space-y-3 py-10">
              <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto">
                <ImageIcon className="w-6 h-6 text-slate-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-100">
                  {imageError ? 'Specimen preview unavailable' : 'Drop an image or select a reference specimen'}
                </p>
                <p className="text-xs text-slate-400">
                  Supports PNG, JPG, and WEBP photographs for surface and structural defect detection.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Select Image File
              </button>
            </div>
          )}

          {isInspecting && (
            <div className="absolute inset-0 bg-slate-950/75 flex flex-col items-center justify-center gap-3 z-20">
              <ScanSearch className="w-7 h-7 text-blue-400 animate-pulse" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-white">Analyzing Surface &amp; Structural Integrity</p>
                <p className="text-xs text-slate-300">
                  Localizing defects and scoring against active tolerance standard
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sample Reference Specimen Strip */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-700">Reference Specimens</span>
            <span className="text-xs text-slate-500">Click any specimen to load into inspection stage</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SAMPLE_SPECIMENS.map((spec) => {
              const isSelected = activeSpecimenId === spec.id;
              return (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => onSelectSpecimen(spec)}
                  className={`group text-left bg-white border rounded-md overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isSelected
                      ? 'border-blue-600 ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="aspect-[4/3] bg-slate-100 overflow-hidden relative">
                    <img
                      src={spec.imageUrl}
                      alt={spec.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-150"
                    />
                  </div>
                  <div className="p-2.5 space-y-0.5">
                    <p className="text-xs font-medium text-slate-900 truncate">{spec.title}</p>
                    <p className="text-[11px] font-mono text-slate-500 truncate">{spec.batchId}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Camera Modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Capture Inspection Frame</h3>
              <button
                type="button"
                onClick={stopCamera}
                aria-label="Close camera"
                className="p-1 text-slate-500 hover:text-slate-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-950 aspect-[4/3] flex items-center justify-center">
              {cameraError ? (
                <p className="text-xs text-slate-300 px-6 text-center">{cameraError}</p>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSnapPhoto}
                disabled={Boolean(cameraError)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors"
              >
                <Aperture className="w-4 h-4" />
                <span>Capture Frame</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
