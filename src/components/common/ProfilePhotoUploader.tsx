import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Trash2, User, X, RefreshCw } from 'lucide-react';
import { compressProfileImage, getInitials } from '../../utils/profilePics';
import { useApp } from '../../context/AppContext';

interface ProfilePhotoUploaderProps {
  photoUrl?: string;
  name?: string;
  gender?: 'male' | 'female';
  onPhotoChange: (newPhotoUrl: string | undefined) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const ProfilePhotoUploader: React.FC<ProfilePhotoUploaderProps> = ({
  photoUrl,
  name,
  gender = 'male',
  onPhotoChange,
  size = 'md',
  disabled = false,
}) => {
  const { translate } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera stream when camera modal closes
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleStartCamera = async () => {
    setMenuOpen(false);

    // Check if on mobile device: mobile native capture is smoother via input
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && mobileCameraInputRef.current) {
      mobileCameraInputRef.current.click();
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access not supported on this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // Wait for next tick so videoRef is mounted
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err: any) {
      console.warn('Camera access error:', err);
      // Fallback to mobile input or file picker
      if (mobileCameraInputRef.current) {
        mobileCameraInputRef.current.click();
      } else {
        alert(err.message || 'Could not access camera. Please upload an image from your device.');
      }
    }
  };

  const handleCaptureFromCamera = async () => {
    if (!videoRef.current) return;
    setIsProcessing(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const size = Math.min(video.videoWidth || 400, video.videoHeight || 400);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const sx = ((video.videoWidth || size) - size) / 2;
        const sy = ((video.videoHeight || size) - size) / 2;
        ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const compressed = await compressProfileImage(dataUrl, { size: 128, quality: 0.7 });
        onPhotoChange(compressed);
      }
      stopCamera();
      setCameraOpen(false);
    } catch (err: any) {
      alert('Error capturing photo: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setMenuOpen(false);
    try {
      const compressed = await compressProfileImage(file, { size: 128, quality: 0.7 });
      onPhotoChange(compressed);
    } catch (err: any) {
      alert('Error processing image: ' + (err?.message || 'Invalid image'));
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (mobileCameraInputRef.current) mobileCameraInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    onPhotoChange(undefined);
    setMenuOpen(false);
  };

  const dimClasses = {
    sm: 'w-10 h-10 text-xs',
    md: 'w-16 h-16 text-base',
    lg: 'w-24 h-24 text-2xl',
  }[size];

  const iconClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }[size];

  const initials = getInitials(name);

  return (
    <div className="relative inline-block">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isProcessing}
      />
      <input
        ref={mobileCameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isProcessing}
      />

      {/* Avatar Container */}
      <div
        onClick={() => !disabled && !isProcessing && setMenuOpen(!menuOpen)}
        className={`relative ${dimClasses} rounded-full overflow-hidden border-2 border-white dark:border-zinc-800 shadow-sm cursor-pointer group transition select-none ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:ring-2 hover:ring-teal-500'
        }`}
        title={translate('profile_photo')}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name || 'Avatar'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center font-black ${
              gender === 'female'
                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300'
                : 'bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300'
            }`}
          >
            {name ? initials : <User className={iconClasses} />}
          </div>
        )}

        {/* Hover Camera Overlay */}
        {!disabled && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </div>
        )}
      </div>

      {/* Action Popover Menu */}
      {menuOpen && !disabled && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute start-0 top-full mt-1.5 z-50 w-44 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 py-1 text-xs animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                fileInputRef.current?.click();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-start"
            >
              <Upload className="w-3.5 h-3.5 text-teal-600" />
              <span>{translate('upload_photo')}</span>
            </button>
            <button
              type="button"
              onClick={handleStartCamera}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-start"
            >
              <Camera className="w-3.5 h-3.5 text-blue-600" />
              <span>{translate('take_photo')}</span>
            </button>
            {photoUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition text-start border-t border-zinc-100 dark:border-zinc-800 mt-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{translate('remove_photo')}</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* Desktop Camera Viewfinder Modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Camera className="w-4 h-4 text-teal-600" />
                <span>{translate('take_photo')}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setCameraOpen(false);
                }}
                className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Viewport */}
            <div className="relative aspect-square bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
              />
              {/* Circular framing guide */}
              <div className="absolute inset-4 rounded-full border-2 border-white/60 pointer-events-none" />
            </div>

            {/* Controls */}
            <div className="p-4 flex items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/50">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setCameraOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition"
              >
                {translate('cancel')}
              </button>
              <button
                type="button"
                onClick={handleCaptureFromCamera}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <span>{translate('take_photo')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
