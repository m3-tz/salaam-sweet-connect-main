import { ShoppingCart, Eye, MapPin } from 'lucide-react';
import { useLanguage } from '@/LanguageContext';

interface CatalogCardProps {
  id: string;
  name: string;
  image?: string;
  available: number;
  total: number;
  category?: string;
  location?: string;
  price?: string;
  onView?: () => void;
  onAddToCart?: () => void;
  isLoading?: boolean;
}

export default function CatalogCard({
  id,
  name,
  image,
  available,
  total,
  category,
  location,
  price,
  onView,
  onAddToCart,
  isLoading = false
}: CatalogCardProps) {
  const { t, lang } = useLanguage();
  const isAvailable = available > 0;

  return (
    <div className="group card-3xl overflow-hidden">
      {/* Image Well */}
      <div className="relative image-well bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-slate-400 dark:text-slate-600 text-center">
              <ShoppingCart size={40} className="mx-auto opacity-30 mb-2" />
              <p className="text-xs">{t('لا صورة', 'No image')}</p>
            </div>
          </div>
        )}

        {/* Status Pill */}
        <div className="absolute top-3 left-3 z-10">
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
            isAvailable
              ? 'bg-emerald-500/90 text-white'
              : 'bg-red-500/90 text-white'
          }`}>
            <span className="w-2 h-2 rounded-full bg-white/80" />
            {isAvailable ? t('متاح', 'Available') : t('غير متاح', 'Out')}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div>
          <h3 className="font-black text-slate-900 dark:text-white line-clamp-2 text-sm">
            {name}
          </h3>
        </div>

        {/* Meta Info */}
        <div className="space-y-2 text-xs">
          {category && (
            <div className="text-slate-500 dark:text-slate-400">
              {category}
            </div>
          )}

          {/* Availability */}
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              {t('متوفر', 'Available')}:
            </span>
            <span className={`font-black ${
              available > 5 ? 'text-emerald-600' :
              available > 0 ? 'text-amber-600' :
              'text-red-600'
            }`}>
              {available} / {total}
            </span>
          </div>

          {/* Location */}
          {location && (
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <MapPin size={12} />
              <span className="truncate">{location}</span>
            </div>
          )}

          {/* Price */}
          {price && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-400 text-xs">{price}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onView}
            disabled={isLoading}
            className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors disabled:opacity-50"
          >
            <Eye size={14} />
            {t('عرض', 'View')}
          </button>
          <button
            onClick={onAddToCart}
            disabled={isLoading || !isAvailable}
            className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold text-xs transition-colors active:scale-95 shadow-cta"
          >
            <ShoppingCart size={14} />
            {t('أضف', 'Add')}
          </button>
        </div>
      </div>
    </div>
  );
}
