import React, { useEffect, useRef, useState } from 'react';
import { 
  Camera, X, RefreshCw, AlertCircle, CheckCircle2, Zap, 
  Upload, Flashlight, SwitchCamera, Image as ImageIcon, Search, ArrowRight
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (code: string) => void;
  knownBarcodes?: { barcode: string; name: string; brand: string }[];
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  knownBarcodes = []
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const isDecodingRef = useRef<boolean>(false);
  const nativeDetectorRef = useRef<any>(null);

  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [framesScanned, setFramesScanned] = useState<number>(0);
  const [imageScanning, setImageScanning] = useState<boolean>(false);
  const [scanStatusMsg, setScanStatusMsg] = useState<string>('Initializing camera...');
  const [detectedSuccessCode, setDetectedSuccessCode] = useState<string | null>(null);
  const [skuSearchQuery, setSkuSearchQuery] = useState<string>('');

  // Audio Beep Generator using Web Audio API
  const playScanBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6 note
      osc.frequency.setValueAtTime(1567.98, ctx.currentTime + 0.08); // G6 note
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {
      // Audio context might be restricted
    }
  };

  // Initialize Native BarcodeDetector if available in browser
  useEffect(() => {
    if ('BarcodeDetector' in window) {
      try {
        const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];
        nativeDetectorRef.current = new (window as any).BarcodeDetector({ formats });
      } catch (e) {
        console.warn('Native BarcodeDetector init failed:', e);
      }
    }
    zxingReaderRef.current = new BrowserMultiFormatReader();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    setDetectedSuccessCode(null);
    setFramesScanned(0);
    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
    setTorchOn(false);
    isDecodingRef.current = false;
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    setScanStatusMsg('Opening camera preview...');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCamera(false);
        setCameraError('Camera API is not supported in this browser. Please use photo upload or manual entry below.');
        return;
      }

      // First attempt: try high quality environment (rear) camera
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
          },
          audio: false,
        });
      } catch (firstErr) {
        console.warn('Ideal camera constraints failed, attempting fallback:', firstErr);
        // Fallback attempt: any video stream available
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      if (!stream) {
        throw new Error('No media stream obtained');
      }

      activeStreamRef.current = stream;
      setHasCamera(true);

      // Check for flashlight/torch capability
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const caps: any = track.getCapabilities ? track.getCapabilities() : {};
          setHasTorch(!!caps.torch);
        } catch {
          setHasTorch(false);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play error:', playErr);
        }
      }

      setIsScanning(true);
      setScanStatusMsg('Camera active • Align barcode inside the box');

      // Start continuous optical analysis loop
      startScanLoop();

    } catch (err: any) {
      console.warn('Camera start error:', err);
      setHasCamera(false);
      setIsScanning(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was blocked. Tap "Select Photo" below to scan from a picture, or allow camera permissions in browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. You can upload an image or type the code below.');
      } else {
        setCameraError('Camera preview could not be opened. You can take a photo or enter the SKU below.');
      }
    }
  };

  const startScanLoop = () => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
    }

    // Run frame detection every 90ms
    scanIntervalRef.current = window.setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || isDecodingRef.current) return;

      isDecodingRef.current = true;
      setFramesScanned((f) => f + 1);

      try {
        // Priority 1: Native BarcodeDetector (instant hardware decoding)
        if (nativeDetectorRef.current) {
          try {
            const detected = await nativeDetectorRef.current.detect(video);
            if (detected && detected.length > 0 && detected[0].rawValue) {
              const code = detected[0].rawValue.trim();
              if (code) {
                triggerScanSuccess(code);
                return;
              }
            }
          } catch {
            // Frame pass
          }
        }

        // Priority 2: ZXing software canvas decoder
        if (zxingReaderRef.current) {
          const canvas = canvasRef.current || document.createElement('canvas');
          canvasRef.current = canvas;
          const vw = video.videoWidth;
          const vh = video.videoHeight;

          if (vw > 0 && vh > 0) {
            // Crop center 70% where reticle is focused for sharp contrast
            const cropW = Math.floor(vw * 0.75);
            const cropH = Math.floor(vh * 0.65);
            const cropX = Math.floor((vw - cropW) / 2);
            const cropY = Math.floor((vh - cropH) / 2);

            canvas.width = cropW;
            canvas.height = cropH;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            if (ctx) {
              ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

              try {
                const result = zxingReaderRef.current.decodeFromCanvas(canvas);
                if (result && result.getText()) {
                  const code = result.getText().trim();
                  if (code) {
                    triggerScanSuccess(code);
                    return;
                  }
                }
              } catch {
                // NotFoundException on this frame (expected when barcode is not in frame)
              }
            }
          }
        }
      } catch (e) {
        // Ignored frame error
      } finally {
        isDecodingRef.current = false;
      }
    }, 90);
  };

  const triggerScanSuccess = (code: string) => {
    if (!code) return;
    setDetectedSuccessCode(code);
    playScanBeep();
    stopCamera();

    setTimeout(() => {
      onScanSuccess(code);
      onClose();
    }, 350);
  };

  const toggleTorch = async () => {
    try {
      const stream = activeStreamRef.current;
      if (stream) {
        const track = stream.getVideoTracks()[0];
        if (track) {
          const nextTorch = !torchOn;
          await (track as any).applyConstraints({
            advanced: [{ torch: nextTorch }]
          });
          setTorchOn(nextTorch);
        }
      }
    } catch (e) {
      console.warn('Flashlight toggle error:', e);
    }
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageScanning(true);
    setScanStatusMsg('Scanning photo image...');

    try {
      if (!zxingReaderRef.current) {
        zxingReaderRef.current = new BrowserMultiFormatReader();
      }

      const imageUrl = URL.createObjectURL(file);

      // Check with native detector if available
      let decodedText: string | null = null;
      if (nativeDetectorRef.current) {
        try {
          const img = new Image();
          img.src = imageUrl;
          await img.decode();
          const detected = await nativeDetectorRef.current.detect(img);
          if (detected && detected.length > 0 && detected[0].rawValue) {
            decodedText = detected[0].rawValue.trim();
          }
        } catch {
          // fall through to zxing
        }
      }

      if (!decodedText) {
        const result = await zxingReaderRef.current.decodeFromImageUrl(imageUrl);
        if (result && result.getText()) {
          decodedText = result.getText().trim();
        }
      }

      URL.revokeObjectURL(imageUrl);

      if (decodedText) {
        triggerScanSuccess(decodedText);
      } else {
        setScanStatusMsg('Could not detect barcode from this photo. Please try a clearer picture.');
      }
    } catch (err) {
      console.warn('Image decode error:', err);
      setScanStatusMsg('Barcode could not be read from this photo. Enter numbers manually below.');
    } finally {
      setImageScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!isOpen) return null;

  // Filtered known products for quick tap
  const filteredKnown = knownBarcodes.filter((kb) => {
    if (!skuSearchQuery) return true;
    const q = skuSearchQuery.toLowerCase();
    return kb.barcode.includes(q) || kb.name.toLowerCase().includes(q) || kb.brand.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg max-h-[95vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl text-white">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                Cosmetics Barcode Scanner
                {isScanning && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Live Active
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Hold barcode steady inside the reticle frame
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            title="Close Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Camera Viewport */}
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black border border-slate-800 shadow-inner flex items-center justify-center">
            {hasCamera && !cameraError ? (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="h-full w-full object-cover"
                />

                {/* Reticle Frame & Laser */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
                  <div className={`relative w-64 h-36 border-2 rounded-2xl transition-all duration-300 ${
                    detectedSuccessCode
                      ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_30px_rgba(52,211,153,0.8)]'
                      : 'border-pink-500/80 bg-pink-500/5 shadow-[0_0_20px_rgba(236,72,153,0.4)]'
                  }`}>
                    {/* Reticle Corners */}
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-white rounded-tl-sm"></div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-white rounded-tr-sm"></div>
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-white rounded-bl-sm"></div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-white rounded-br-sm"></div>

                    {/* Animated Laser Line */}
                    {!detectedSuccessCode && (
                      <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-pulse"></div>
                    )}

                    {/* Status Pill */}
                    <div className="absolute -bottom-7 inset-x-0 text-center">
                      <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border shadow-md ${
                        detectedSuccessCode
                          ? 'bg-emerald-600 text-white border-emerald-400 font-bold'
                          : 'bg-black/75 text-pink-300 border-pink-500/30'
                      }`}>
                        {detectedSuccessCode ? `✓ Scanned: ${detectedSuccessCode}` : scanStatusMsg}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Floating Top Camera Controls (Torch & Flip) */}
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  {hasTorch && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2 rounded-xl backdrop-blur-md transition shadow-md cursor-pointer ${
                        torchOn ? 'bg-amber-400 text-slate-900 font-bold' : 'bg-black/60 text-white hover:bg-black/80'
                      }`}
                      title="Toggle Torch / Flashlight"
                    >
                      <Flashlight className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition shadow-md cursor-pointer"
                    title={`Switch to ${facingMode === 'environment' ? 'Front' : 'Back'} Camera`}
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center p-6 space-y-3">
                <AlertCircle className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
                <h4 className="text-sm font-bold text-white">Camera Preview Unavailable</h4>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  {cameraError || 'Camera could not be started. Tap "Select Photo" to scan packaging from your gallery, or type the code below.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-xs font-semibold text-white shadow-sm transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload Photo Instead
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Photo Upload Button */}
          <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">Scan from Image / Gallery Photo</p>
                <p className="text-[11px] text-slate-400">Snap photo of barcode with camera or pick from gallery</p>
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            <button
              type="button"
              disabled={imageScanning}
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-semibold text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              {imageScanning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Decoding...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" /> Select Photo
                </>
              )}
            </button>
          </div>

          {/* Manual Barcode / SKU Code Entry */}
          <div className="pt-2">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Or Type Barcode / SKU Number Manually
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualCodeInput.trim()) {
                    e.preventDefault();
                    triggerScanSuccess(manualCodeInput.trim());
                  }
                }}
                placeholder="e.g. 8901030784912 or 773602058471"
                className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2 text-xs sm:text-sm text-white font-mono placeholder-slate-500 focus:border-pink-500 focus:outline-hidden"
              />
              <button
                type="button"
                disabled={!manualCodeInput.trim()}
                onClick={() => triggerScanSuccess(manualCodeInput.trim())}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 font-semibold text-xs sm:text-sm text-white disabled:opacity-40 hover:brightness-110 transition cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <span>Enter</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Instant 1-Tap Preset Barcode Selector */}
          {knownBarcodes.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1 font-medium text-pink-300">
                  <Zap className="w-3.5 h-3.5" /> Quick Tap Cosmetic SKUs ({knownBarcodes.length})
                </span>
                <span className="text-[10px] text-slate-500">Tap to instantly select</span>
              </div>

              {/* Search filter for presets */}
              {knownBarcodes.length > 6 && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filter brands (MAC, Lakmé, Huda)..."
                    value={skuSearchQuery}
                    onChange={(e) => setSkuSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:border-pink-500 focus:outline-hidden"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {filteredKnown.slice(0, 10).map((kb) => (
                  <button
                    key={kb.barcode}
                    type="button"
                    onClick={() => triggerScanSuccess(kb.barcode)}
                    className="text-left text-xs bg-slate-800/80 hover:bg-pink-600/30 hover:border-pink-500 border border-slate-700/80 rounded-xl p-2 transition cursor-pointer flex flex-col justify-between"
                  >
                    <div className="font-mono font-bold text-pink-400 tracking-wide">{kb.barcode}</div>
                    <div className="text-[11px] text-slate-300 truncate mt-0.5">
                      <span className="text-pink-300 font-semibold">{kb.brand}</span> • {kb.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
