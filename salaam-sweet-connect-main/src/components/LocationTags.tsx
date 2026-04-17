import { MapPin } from 'lucide-react';

interface LocationTagsProps {
  location?: string;
}

export const LocationTags = ({ location }: LocationTagsProps) => {
  if (!location) {
    return (
      <div className="flex items-center text-xs font-bold text-slate-500 bg-slate-50 p-2 rounded-lg w-fit">
        <MapPin className="w-3.5 h-3.5 ml-1 text-slate-400" /> غير محدد
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 p-1.5 rounded-lg w-full">
      <MapPin className="w-3.5 h-3.5 ml-1 text-slate-400 shrink-0" />
      {location.split(',').map((loc, i) => (
        <span
          key={i}
          className="bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[10px] text-blue-700 shadow-sm whitespace-nowrap font-black"
        >
          {loc.trim()}
        </span>
      ))}
    </div>
  );
};