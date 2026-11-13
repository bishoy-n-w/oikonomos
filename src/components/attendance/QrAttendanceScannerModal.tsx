import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import type { Kid, AttendanceStatus } from '../../types';
import { parseKidQrPayload } from '../../utils/qrCode';
import { playSuccessChime, playNeutralTone, playWarningTone } from '../../utils/audioChime';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import { 
  X, 
  Camera, 
  SwitchCamera, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles,
  Smartphone,
  Tv
} from 'lucide-react';

export interface QrAttendanceScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeClassKids: Kid[];
  allChurchKids: Kid[];
  classes: Array<{ id: string; displayName: string }>;
  currentRecords: Record<string, { status: AttendanceStatus; notes?: string }>;
  onRecordAttendance: (kidId: string, status: AttendanceStatus) => void;
}

interface ScanBanner {
  type: 'success' | 'already' | 'wrong_class' | 'error';
  kid?: Kid;
  message: string;
  otherClassName?: string;
}

export const QrAttendanceScannerModal: React.FC<QrAttendanceScannerModalProps> = ({
  isOpen,
  onClose,
  activeClassKids,
  allChurchKids,
  classes,
  currentRecords,
  onRecordAttendance,
}) => {
  const { language, translate } = useApp();
  const isRtl = language === 'ar';

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [banner, setBanner] = useState<ScanBanner | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastScannedTimeRef = useRef<Record<string, number>>({});
  const bannerTimerRef = useRef<any>(null);

  useModalEscape(onClose, isOpen);

  const showBanner = useCallback((data: ScanBanner, durationMs = 2500) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setBanner(data);
    bannerTimerRef.current = setTimeout(() => {
      setBanner(null);
    }, durationMs);
  }, []);

  const handleDecodedQr = useCallback((rawQr: string) => {
    const parsed = parseKidQrPayload(rawQr);
    if (!parsed || !parsed.kidId) {
      playWarningTone();
      showBanner({
        type: 'error',
        message: translate('unrecognized_qr'),
      });
      return;
    }

    const { kidId } = parsed;
    const now = Date.now();
    const lastScan = lastScannedTimeRef.current[kidId] || 0;

    // Cooldown debouncer: 10 seconds per student to prevent spam
    if (now - lastScan < 10000) {
      const isAlreadyPresent = currentRecords[kidId]?.status === 'present';
      if (isAlreadyPresent) {
        const student = allChurchKids.find((k) => k.id === kidId);
        playNeutralTone();
        showBanner({
          type: 'already',
          kid: student,
          message: `${student?.info.fullName || 'Student'} ${translate('already_marked_present')}`,
        }, 1800);
        return;
      }
    }

    // Check if kid belongs to current class
    const inCurrentClass = activeClassKids.find((k) => k.id === kidId);

    if (inCurrentClass) {
      lastScannedTimeRef.current[kidId] = now;
      onRecordAttendance(kidId, 'present');
      playSuccessChime();
      showBanner({
        type: 'success',
        kid: inCurrentClass,
        message: `${inCurrentClass.info.fullName} — ${translate('marked_present_success')}!`,
      }, isKioskMode ? 2200 : 2500);
      return;
    }

    // Check if kid belongs to this church but another class
    const inOtherClass = allChurchKids.find((k) => k.id === kidId);
    if (inOtherClass) {
      const otherClassDoc = classes.find((c) => c.id === inOtherClass.activeAssignment?.classId);
      const otherClassName = otherClassDoc?.displayName || inOtherClass.activeAssignment?.classId || 'Another Class';

      playWarningTone();
      showBanner({
        type: 'wrong_class',
        kid: inOtherClass,
        message: `${inOtherClass.info.fullName}`,
        otherClassName,
      }, 5000);
      return;
    }

    // Unrecognized ID
    playWarningTone();
    showBanner({
      type: 'error',
      message: translate('unrecognized_qr'),
    }, 2000);
  }, [translate, currentRecords, allChurchKids, activeClassKids, onRecordAttendance, isKioskMode, classes, showBanner]);

  // Start Camera Stream
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setCameraError(null);

    const startCamera = async () => {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        console.error('Camera access failed:', err);
        if (mounted) {
          setCameraError(err.message || translate('camera_permission_denied'));
        }
      }
    };

    startCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, [isOpen, facingMode, translate]);

  // Video Frame Scanner Loop using jsQR
  useEffect(() => {
    if (!isOpen || cameraError) return;

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            handleDecodedQr(code.data);
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(scanFrame);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isOpen, cameraError, handleDecodedQr]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${
          isKioskMode ? 'max-w-2xl' : 'max-w-lg'
        } bg-zinc-950 text-white rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col transition-all cursor-default`}
      >
        {/* Top Control Bar */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-1.5">
                <span>{translate('qr_scanner_title')}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h3>
              <p className="text-[11px] text-zinc-400">
                {translate('point_camera_at_badge')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Handheld / Kiosk Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsKioskMode(!isKioskMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                isKioskMode
                  ? 'bg-purple-600/30 text-purple-300 border-purple-500/40'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
              }`}
              title={isKioskMode ? translate('kiosk_mode') : translate('handheld_mode')}
            >
              {isKioskMode ? <Tv className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {isKioskMode ? translate('kiosk_mode') : translate('handheld_mode')}
              </span>
            </button>

            {/* Camera Switcher (Front/Back) */}
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 transition cursor-pointer"
              title={translate('switch_camera')}
            >
              <SwitchCamera className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewfinder Area */}
        <div className="relative aspect-4/3 sm:aspect-16/10 bg-black flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center max-w-sm space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-zinc-200">{translate('camera_permission_denied')}</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {cameraError}. Please enable camera permissions in your browser or device settings.
              </p>
            </div>
          ) : (
            <>
              {/* Live Video Stream */}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                autoPlay
                muted
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Holographic Target Square Viewfinder */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
                <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-teal-500/60 rounded-3xl shadow-[0_0_50px_rgba(20,184,166,0.3)] flex items-center justify-center overflow-hidden">
                  {/* Corner Accent Brackets */}
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-teal-400 rounded-tl-2xl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-teal-400 rounded-tr-2xl" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-teal-400 rounded-bl-2xl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-teal-400 rounded-br-2xl" />

                  {/* Animated Scanner Laser */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_8px_#2dd4bf] animate-[bounce_2s_infinite]" />
                </div>
              </div>

              {/* Kiosk Mode Welcome Overlay Card */}
              {isKioskMode && banner && banner.type === 'success' && banner.kid && (
                <div
                  dir={isRtl ? 'rtl' : 'ltr'}
                  className="absolute inset-4 z-20 flex flex-col items-center justify-center bg-zinc-950/95 border-2 border-teal-500 rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200"
                >
                  <div className="w-24 h-24 rounded-full p-1 border-4 border-teal-400 shadow-xl overflow-hidden mb-3">
                    {banner.kid.info.photoUrl ? (
                      <img
                        src={banner.kid.info.photoUrl}
                        alt=""
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full bg-teal-800 text-teal-100 flex items-center justify-center text-2xl font-black rounded-full">
                        {banner.kid.info.fullName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-teal-400 font-bold text-xs uppercase tracking-wider mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span>{translate('scan_welcome')}</span>
                  </div>
                  <h2 className="text-2xl font-black text-white truncate max-w-full">
                    {banner.kid.info.fullName}
                  </h2>
                  <span className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                    <span>{translate('marked_present_success')}</span>
                  </span>
                </div>
              )}

              {/* Handheld Live Feedback Toast / Wrong Class Dialog */}
              {(!isKioskMode || banner?.type !== 'success') && banner && (
                <div
                  dir={isRtl ? 'rtl' : 'ltr'}
                  className={`absolute bottom-4 inset-x-4 z-20 p-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 border animate-in slide-in-from-bottom duration-200 ${
                    banner.type === 'success'
                      ? 'bg-teal-950/90 text-teal-200 border-teal-500/60'
                      : banner.type === 'already'
                      ? 'bg-amber-950/90 text-amber-200 border-amber-500/60'
                      : banner.type === 'wrong_class'
                      ? 'bg-indigo-950/95 text-indigo-200 border-indigo-500/80 flex-col sm:flex-row'
                      : 'bg-rose-950/90 text-rose-200 border-rose-500/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {banner.type === 'success' && <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />}
                    {banner.type === 'already' && <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />}
                    {banner.type === 'wrong_class' && <AlertTriangle className="w-5 h-5 text-indigo-400 shrink-0" />}
                    {banner.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}

                    <div className="text-xs">
                      {banner.type === 'wrong_class' ? (
                        <div>
                          <p className="font-bold text-white text-sm">{banner.kid?.info.fullName}</p>
                          <p className="text-[11px] text-indigo-300">
                            {translate('student_not_in_class')} ({banner.otherClassName}).
                          </p>
                        </div>
                      ) : (
                        <span className="font-bold">{banner.message}</span>
                      )}
                    </div>
                  </div>

                  {/* Wrong Class Transfer Action Button */}
                  {banner.type === 'wrong_class' && banner.kid && (
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-indigo-800">
                      <button
                        type="button"
                        onClick={() => {
                          if (banner.kid) {
                            onRecordAttendance(banner.kid.id, 'present');
                            playSuccessChime();
                            showBanner({
                              type: 'success',
                              kid: banner.kid,
                              message: `${banner.kid.info.fullName} — ${translate('marked_present_success')}!`,
                            });
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
                      >
                        {translate('marked_present_success')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBanner(null)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
                      >
                        {translate('cancel')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Statistics */}
        <div className="p-3 bg-zinc-900 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span>Roster: {activeClassKids.length}</span>
            <span>•</span>
            <span className="text-teal-400 font-bold">
              Present: {Object.values(currentRecords).filter((r) => r.status === 'present').length}
            </span>
          </div>
          <span className="text-[11px] text-zinc-500">
            {isRtl ? 'مدعوم بالتعرف البصري المباشر' : 'Powered by Real-Time Optical AI'}
          </span>
        </div>
      </div>
    </div>
  );
};
