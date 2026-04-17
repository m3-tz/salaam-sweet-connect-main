import { MapPin } from 'lucide-react';

/**
 * LocationBadge — يعرض مسار الموقع بصيغة:  LAB1 → BOX1 → F2
 *
 * يقبل:
 *   location  — نص المسار الكامل (قد يحتوي على عدة مسارات مفصولة بـ " | ")
 *   small     — حجم أصغر للعرض المضغوط
 *   className — كلاسات إضافية اختيارية
 */
interface LocationBadgeProps {
  location?: string | null;
  small?: boolean;
  className?: string;
}

const LocationBadge = ({ location, small = false, className = '' }: LocationBadgeProps) => {
  if (!location) return null;

  // دعم عدة مواقع مفصولة بـ " | "
  const paths = location.split(' | ').filter(Boolean);

  if (paths.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {paths.map((path, pi) => {
        const segments = path.split(' → ').map(s => s.trim()).filter(Boolean);
        return (
          <span
            key={pi}
            dir="ltr"
            className={`inline-flex items-center gap-0.5 font-bold rounded-lg border
              bg-[#0f172a] text-blue-300 border-blue-700
              shadow-[0_0_8px_rgba(59,130,246,0.35)]
              ${small
                ? 'text-[10px] px-1.5 py-0.5'
                : 'text-xs px-2 py-1'}`}
          >
            <MapPin className={`shrink-0 text-blue-400 ${small ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
            {segments.map((seg, si) => (
              <span key={si} className="flex items-center gap-0.5">
                {si > 0 && (
                  <span className="text-blue-500 mx-0.5">→</span>
                )}
                <span className="text-blue-100">{seg}</span>
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
};

export default LocationBadge;
