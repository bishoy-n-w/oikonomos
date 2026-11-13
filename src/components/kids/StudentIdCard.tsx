import React, { useEffect, useState } from 'react';
import type { Kid } from '../../types';
import { buildKidQrPayload, generateQrDataUrl } from '../../utils/qrCode';
import { Church as ChurchIcon } from 'lucide-react';

export interface StudentIdCardProps {
  kid: Kid;
  churchId: string;
  churchName: string;
  churchLogoUrl?: string;
  className: string;
  serviceGroupName?: string;
  yearName?: string;
  yearBadgeColor?: string;
  lang?: 'en' | 'ar';
}

export const StudentIdCard: React.FC<StudentIdCardProps> = ({
  kid,
  churchId,
  churchName,
  churchLogoUrl,
  className,
  serviceGroupName,
  yearName,
  yearBadgeColor = '#0d9488',
  lang = 'en',
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const isRtl = lang === 'ar';

  useEffect(() => {
    let active = true;
    const payload = buildKidQrPayload(churchId, kid.id);
    generateQrDataUrl(payload).then((url) => {
      if (active) setQrUrl(url);
    });
    return () => {
      active = false;
    };
  }, [churchId, kid.id]);

  const initials = (kid.info.fullName || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const shortId = kid.id.replace(/^kid_/, '').slice(0, 8);

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="student-id-card relative bg-white text-zinc-900 border border-zinc-200 shadow-sm rounded-2xl overflow-hidden flex flex-col justify-between p-3 select-none box-border"
      style={{
        width: '85.6mm',
        height: '53.98mm',
        maxWidth: '85.6mm',
        maxHeight: '53.98mm',
        pageBreakInside: 'avoid',
      }}
    >
      {/* Decorative top accent border matching Academic Year Color */}
      <div
        className="absolute top-0 inset-x-0 h-1.5"
        style={{ backgroundColor: yearBadgeColor }}
      />

      {/* Card Header: Church Brand & Year Badge */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {churchLogoUrl ? (
            <img
              src={churchLogoUrl}
              alt=""
              className="w-6 h-6 rounded-md object-cover border border-zinc-200 shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <ChurchIcon className="w-3.5 h-3.5" />
            </div>
          )}
          <div className="min-w-0 leading-tight">
            <h4 className="font-extrabold text-[11px] text-zinc-900 truncate">
              {churchName}
            </h4>
            <span className="text-[8px] font-semibold text-zinc-500 uppercase tracking-wider block">
              {isRtl ? 'خدمة مدارس الأحد' : 'Sunday School'}
            </span>
          </div>
        </div>

        {/* Academic Year Pill */}
        {yearName && (
          <span
            className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white shrink-0 shadow-2xs"
            style={{ backgroundColor: yearBadgeColor }}
          >
            {yearName}
          </span>
        )}
      </div>

      {/* Card Center: Photo, Name, and Class Details */}
      <div className="flex items-center gap-2.5 my-auto">
        {/* Student Avatar */}
        <div className="w-13 h-13 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 shrink-0 flex items-center justify-center shadow-2xs">
          {kid.info.photoUrl ? (
            <img
              src={kid.info.photoUrl}
              alt={kid.info.fullName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-black text-sm text-teal-700 bg-teal-50 w-full h-full flex items-center justify-center">
              {initials}
            </span>
          )}
        </div>

        {/* Student Typography */}
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-xs text-zinc-950 truncate leading-tight">
            {kid.info.fullName}
          </h3>
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-md border border-teal-100 truncate">
              {className}
            </span>
            {serviceGroupName && (
              <span className="text-[9px] font-medium text-zinc-600 truncate">
                • {serviceGroupName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card Footer: Scan QR code & ID label */}
      <div className="flex items-end justify-between gap-2 border-t border-zinc-100 pt-1.5 mt-auto">
        <div>
          <span className="text-[8px] uppercase tracking-wider text-zinc-400 font-mono block">
            ID: {shortId}
          </span>
          <span className="text-[8px] font-semibold text-zinc-500">
            {isRtl ? 'امسح لتسجيل الحضور' : 'Scan for Attendance'}
          </span>
        </div>

        {/* QR Code */}
        <div className="w-10 h-10 bg-white border border-zinc-200 rounded-md p-0.5 flex items-center justify-center shrink-0 shadow-2xs">
          {qrUrl ? (
            <img src={qrUrl} alt="QR Code" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full bg-zinc-100 animate-pulse rounded" />
          )}
        </div>
      </div>
    </div>
  );
};
