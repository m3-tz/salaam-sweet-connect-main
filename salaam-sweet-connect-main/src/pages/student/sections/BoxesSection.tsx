import { useState, useEffect } from 'react';
import { useLanguage } from '@/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { apiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Box as BoxIcon, Package, Loader2, CheckCircle2, Clock,
  AlertTriangle, Calendar, Eye, Layers, Hash, Tag, MapPin,
  ChevronRight,
} from 'lucide-react';

interface BoxItem {
  id: number;
  item_name: string;
  quantity_required: number;
  available_in_stock?: number;
  imageUrl?: string;
  item_category?: string;
  item_location?: string;
}

interface Box {
  id: number;
  name: string;
  name_en: string;
  description: string;
  image_url: string;
  category: string;
  code_prefix: string;
  items_count: number;
  total_qty: number;
  total_instances: number;
  available_instances: number;
  loaned_instances: number;
  items?: BoxItem[];
}

interface BoxLoan {
  id: number;
  box_id: number;
  instance_id: number;
  university_id: string;
  checkout_date: string;
  expected_return_date: string;
  returned_at: string;
  status: 'active' | 'returned' | 'overdue' | 'partial_return';
  box_name: string;
  box_image: string;
  instance_qr: string;
  instance_label: string;
  code_prefix: string;
  items_count: number;
}

interface BoxesSectionProps {
  userId: string;
  userName: string;
}

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr); due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86400000);
}

export default function BoxesSection({ userId }: BoxesSectionProps) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();

  const [boxes, setBoxes] = useState<Box[]>([]);
  const [myLoans, setMyLoans] = useState<BoxLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'catalog' | 'mine'>('catalog');
  const [detailBox, setDetailBox] = useState<Box | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, lRes] = await Promise.all([
        fetch(apiUrl('/api/boxes')),
        fetch(apiUrl(`/api/box-loans?student=${userId}`)),
      ]);
      const bData = await bRes.json();
      const lData = await lRes.json();
      if (bData.status === 'success') setBoxes(bData.data || []);
      if (lData.status === 'success') setMyLoans(lData.data || []);
    } catch {
      toast({ title: t('فشل التحميل', 'Failed to load'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (userId) fetchData(); }, [userId]);

  const openDetail = async (box: Box) => {
    setDetailLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/boxes/${box.id}`));
      const data = await res.json();
      if (data.status === 'success') {
        setDetailBox(data.data);
      } else {
        toast({ title: data.message || t('تعذّر تحميل التفاصيل', 'Failed to load details'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('تعذّر الاتصال بالخادم', 'Cannot reach server'), variant: 'destructive' });
    } finally {
      setDetailLoading(false);
    }
  };

  const activeLoans = myLoans.filter(l => l.status === 'active' || l.status === 'overdue');
  const pastLoans   = myLoans.filter(l => l.status === 'returned' || l.status === 'partial_return');
  const overdueCount = activeLoans.filter(l => l.status === 'overdue').length;

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <div className="card-3xl bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800 dark:from-slate-800 dark:via-blue-900 dark:to-indigo-950 p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0">
              <BoxIcon className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black">{t('البوكسات الجاهزة', 'Ready-Made Kits')}</h2>
              <p className="text-blue-100 text-sm font-medium">
                {t('حزم قطع جاهزة لمشاريعك ومعسكراتك', 'Pre-built kits for your projects and camps')}
              </p>
            </div>
          </div>
          {/* Stats */}
          <div className="flex gap-3">
            <div className="text-center bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 min-w-[72px]">
              <div className="text-2xl font-black">{activeLoans.length}</div>
              <div className="text-[10px] font-bold text-blue-100">{t('لديّ الآن', 'Active')}</div>
            </div>
            <div className="text-center bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 min-w-[72px]">
              <div className="text-2xl font-black">{boxes.filter(b => b.available_instances > 0).length}</div>
              <div className="text-[10px] font-bold text-blue-100">{t('متاح', 'Available')}</div>
            </div>
          </div>
        </div>
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-cyan-400 rounded-full blur-3xl opacity-20 blob-pulse" />
      </div>

      {/* ── Overdue Alert ──────────────────────────────────────── */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-black text-red-700 dark:text-red-400 text-sm">
              {t(`لديك ${overdueCount} استعارة متأخرة`, `You have ${overdueCount} overdue loan(s)`)}
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
              {t('يرجى إرجاع البوكسات للمشرف في أقرب وقت', 'Please return the boxes to the supervisor as soon as possible')}
            </p>
          </div>
          <button onClick={() => setTab('mine')} className="ms-auto text-xs font-bold text-red-600 underline">
            {t('عرض', 'View')}
          </button>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setTab('catalog')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-colors ${
            tab === 'catalog' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4 inline me-1.5" />
          {t('كتالوج البوكسات', 'Boxes Catalog')} ({boxes.length})
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-colors relative ${
            tab === 'mine' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 inline me-1.5" />
          {t('بوكساتي', 'My Boxes')}
          {activeLoans.length > 0 && (
            <span className="ms-1.5 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {activeLoans.length}
            </span>
          )}
          {overdueCount > 0 && (
            <span className="ms-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {overdueCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      {tab === 'catalog' ? (
        boxes.length === 0 ? (
          <div className="text-center py-16 card-3xl border-dashed">
            <BoxIcon className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-lg font-black text-slate-500">{t('لا توجد بوكسات متاحة', 'No boxes available')}</p>
            <p className="text-sm text-slate-400 mt-1">{t('راجع المشرف لإضافة بوكسات جديدة', 'Ask the admin to add new boxes')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boxes.map(box => {
              const avail = box.available_instances ?? 0;
              const total = box.total_instances ?? 0;
              const hasAny = avail > 0;
              return (
                <div key={box.id} className="card-3xl overflow-hidden flex flex-col group hover:shadow-lg transition-shadow">
                  {/* Image */}
                  <div className="relative image-well bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                    {box.image_url ? (
                      <img src={box.image_url} alt={box.name} className="w-full h-full object-contain p-4" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BoxIcon size={48} className="text-slate-300" />
                      </div>
                    )}
                    {/* Availability badge */}
                    <div className="absolute top-3 start-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-sm ${
                        hasAny
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-400 text-white'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${hasAny ? 'bg-white animate-pulse' : 'bg-white/60'}`} />
                        {hasAny ? t(`${avail} متاح`, `${avail} available`) : t('غير متاح', 'Unavailable')}
                      </span>
                    </div>
                    {/* Prefix badge */}
                    <div className="absolute top-3 end-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        <Hash size={9} /> {box.code_prefix || 'BX'}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col">
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white leading-tight">{box.name}</h3>
                      {box.name_en && <p className="text-xs text-slate-400 font-mono mt-0.5">{box.name_en}</p>}
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <Tag size={10} /> {box.category}
                      </span>
                      <span className="font-mono text-slate-500">
                        {box.items_count} {t('قطعة', 'items')}
                      </span>
                    </div>

                    {/* Instance bar */}
                    {total > 0 && (
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                          <span>{t('التوفر', 'Availability')}</span>
                          <span className="font-mono">{avail}/{total}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${hasAny ? 'bg-emerald-500' : 'bg-slate-400'}`}
                            style={{ width: `${total > 0 ? (avail / total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {box.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{box.description}</p>
                    )}

                    <Button
                      onClick={() => openDetail(box)}
                      variant="outline"
                      className="w-full gap-2 dark:border-slate-700 mt-auto"
                      disabled={detailLoading}
                    >
                      {detailLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                      {t('عرض المحتويات', 'View Contents')}
                      <ChevronRight size={14} className="ms-auto rtl:rotate-180" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <MyBoxesList active={activeLoans} past={pastLoans} t={t} />
      )}

      {/* ── Box Detail Dialog ──────────────────────────────────── */}
      {detailBox && (
        <Dialog open onOpenChange={() => setDetailBox(null)}>
          <DialogContent
            className="max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                <BoxIcon className="w-6 h-6 text-blue-600" />
                {detailBox.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {detailBox.image_url && (
                <img
                  src={detailBox.image_url}
                  alt={detailBox.name}
                  className="w-full h-44 object-contain bg-slate-50 dark:bg-slate-800 rounded-xl"
                />
              )}

              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl py-2.5">
                  <div className="text-xl font-black text-emerald-600">
                    {(detailBox as any).available_instances ?? 0}
                  </div>
                  <div className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400">{t('متاح', 'Available')}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5">
                  <div className="text-xl font-black text-slate-700 dark:text-white">
                    {(detailBox as any).total_instances ?? 0}
                  </div>
                  <div className="text-[9px] font-bold text-slate-500">{t('إجمالي', 'Total')}</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl py-2.5">
                  <div className="text-xl font-black text-blue-600">
                    {detailBox.items_count ?? 0}
                  </div>
                  <div className="text-[9px] font-bold text-blue-700 dark:text-blue-400">{t('قطعة', 'Items')}</div>
                </div>
              </div>

              {/* Prefix + category */}
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="font-mono font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                  <Hash size={10} /> {detailBox.code_prefix || 'BX'}
                </span>
                <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <Tag size={10} /> {detailBox.category}
                </span>
              </div>

              {detailBox.description && (
                <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                  {detailBox.description}
                </p>
              )}

              {/* Items list */}
              <div>
                <h4 className="font-black text-sm mb-2 text-slate-900 dark:text-white flex items-center gap-2">
                  <Package size={14} className="text-blue-600" />
                  {t('محتويات البوكس', 'Box Contents')}
                </h4>
                <div className="space-y-1.5">
                  {(detailBox.items || []).length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">{t('لا توجد محتويات', 'No items listed')}</p>
                  ) : (detailBox.items || []).map((it, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      {it.imageUrl
                        ? <img src={it.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                        : <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                            <Package size={14} className="text-slate-400" />
                          </div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{it.item_name}</p>
                        {(it.item_category || it.item_location) && (
                          <p className="text-[10px] text-slate-500 truncate flex items-center gap-2">
                            {it.item_category && <span className="flex items-center gap-0.5"><Tag size={8} /> {it.item_category}</span>}
                            {it.item_location && <span className="flex items-center gap-0.5"><MapPin size={8} /> {it.item_location}</span>}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-black font-mono text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg flex-shrink-0">
                        ×{it.quantity_required}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Info note */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                {t('لاستلام هذا البوكس، يجب أن يصرفه لك المشرف في المعمل', 'To receive this kit, the lab supervisor must issue it to you')}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── My Boxes List ──────────────────────────────────────────────────
function MyBoxesList({ active, past, t }: {
  active: BoxLoan[];
  past: BoxLoan[];
  t: (a: string, e: string) => string;
}) {
  if (!active.length && !past.length) {
    return (
      <div className="text-center py-16 card-3xl border-dashed">
        <BoxIcon className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-lg font-black text-slate-500">{t('لا توجد بوكسات لديك', 'No boxes assigned to you')}</p>
        <p className="text-sm text-slate-400 mt-1">{t('ستظهر البوكسات هنا بعد أن يصرفها لك المشرف', 'Boxes will appear here once the supervisor issues them to you')}</p>
      </div>
    );
  }

  const renderLoan = (loan: BoxLoan) => {
    const isOverdue  = loan.status === 'overdue';
    const isReturned = loan.status === 'returned';
    const isPartial  = loan.status === 'partial_return';
    const days = daysUntil(loan.expected_return_date);

    const headerBg = isOverdue  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      : isPartial  ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
      : isReturned ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';

    const statusColor = isOverdue  ? 'text-red-600'
      : isPartial  ? 'text-orange-600'
      : isReturned ? 'text-emerald-600'
      : 'text-blue-600';

    const statusLabel = isOverdue  ? t('متأخرة ⚠️', 'Overdue ⚠️')
      : isPartial  ? t('إرجاع ناقص', 'Partial return')
      : isReturned ? t('مُرجعة ✅', 'Returned ✅')
      : t('نشطة', 'Active');

    return (
      <div key={loan.id} className="card-3xl overflow-hidden">
        {/* Status header */}
        <div className={`px-4 py-2 border-b flex items-center justify-between ${headerBg}`}>
          <span className={`text-xs font-black ${statusColor}`}>
            {statusLabel}
          </span>
          <span className="text-[10px] font-mono text-slate-500">#{loan.id}</span>
        </div>

        <div className="p-4 space-y-3">
          {/* Box info */}
          <div className="flex items-start gap-3">
            {loan.box_image ? (
              <img src={loan.box_image} alt={loan.box_name}
                className="w-14 h-14 rounded-xl object-contain bg-slate-50 dark:bg-slate-800 p-1 flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                <BoxIcon size={24} className="text-slate-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-slate-900 dark:text-white truncate leading-tight">{loan.box_name}</h3>
              <p className="text-sm font-black text-blue-600 font-mono mt-0.5">
                🏷 {loan.instance_label || loan.instance_qr || '—'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{loan.items_count} {t('قطعة', 'items')}</p>
            </div>
          </div>

          {/* Due date + days remaining */}
          {!isReturned && !isPartial && (
            <div className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
              isOverdue
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : days <= 2
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
            }`}>
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Calendar size={12} />
                {t('الإرجاع:', 'Due:')} <span className="font-mono font-bold">{loan.expected_return_date}</span>
              </span>
              <span className={`font-black ${
                isOverdue ? 'text-red-600'
                : days <= 2 ? 'text-amber-600'
                : 'text-emerald-600'
              }`}>
                {isOverdue
                  ? t(`${Math.abs(days)} يوم تأخير`, `${Math.abs(days)}d overdue`)
                  : days === 0 ? t('اليوم', 'Today')
                  : t(`${days} يوم`, `${days}d left`)}
              </span>
            </div>
          )}

          {isReturned && loan.returned_at && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-2.5">
              <CheckCircle2 size={13} />
              {t('تم الإرجاع:', 'Returned:')} <span className="font-mono font-bold">{loan.returned_at.split(' ')[0]}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div>
          <h3 className="font-black text-sm text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            {t('قيد الاستعارة', 'Currently Borrowed')} ({active.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{active.map(renderLoan)}</div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h3 className="font-black text-sm text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {t('تم الإرجاع', 'Returned')} ({past.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{past.map(renderLoan)}</div>
        </div>
      )}
    </div>
  );
}
