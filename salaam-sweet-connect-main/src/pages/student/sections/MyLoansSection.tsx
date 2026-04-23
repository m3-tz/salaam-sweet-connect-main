import { useState, useEffect } from 'react';
import { useLanguage } from '@/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { apiUrl } from '@/lib/api';
import {
  Package, Calendar, Clock, ShoppingBag, CheckCircle2, AlertCircle, XCircle,
  Trash2, Archive, RefreshCw, MessageSquare
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface RequestItem {
  componentName: string;
  name_ar?: string;
  name_en?: string;
  requestedQuantity: number;
  approvedQuantity: number;
}

interface StudentRequest {
  id: number;
  requestDate: string;
  expectedReturnDate: string;
  status: string;
  note?: string;
  items: RequestItem[];
}

interface StudentLoan {
  id: number;
  componentName: string;
  name_ar?: string;
  name_en?: string;
  quantity: number;
  borrowDate: string;
  expectedReturnDate: string;
  status: string;
}

interface InventoryItem {
  name?: string;
  name_ar?: string;
  name_en?: string;
  imageUrl: string;
}

interface Props {
  userId: string;
  userName: string;
  onRefresh?: () => void;
}

export default function MyLoansSection({ userId, userName, onRefresh }: Props) {
  const { lang, t } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [loans, setLoans] = useState<StudentLoan[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<StudentRequest | null>(null);

  const getNameAr = (c: any) => c.name_ar || c.componentName;
  const getNameEn = (c: any) => c.name_en || c.name_ar || c.componentName;
  const displayCompName = (c: any) => lang === 'ar' ? getNameAr(c) : getNameEn(c);

  const fetchMyData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [dataRes, invRes] = await Promise.all([
        fetch(apiUrl(`/api/student/my-requests/${userId}`)),
        fetch(apiUrl('/api/items'))
      ]);
      if (dataRes.ok) {
        const data = await dataRes.json();
        setRequests(data.data.requests);
        setLoans(data.data.loans);
      }
      if (invRes.ok) {
        const invData = await invRes.json();
        setInventory(invData.data);
      }
    } catch (error) {
      toast({ title: t('خطأ', 'Error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMyData(); }, [userId]);

  const getImageUrl = (compName: string) => {
    const item = inventory.find(i => i.name === compName || i.name_ar === compName || i.name_en === compName);
    return item?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png';
  };

  const handleCancelRequest = async (reqId: number) => {
    if (!confirm(t('هل أنت متأكد من إلغاء الطلب؟', 'Are you sure?'))) return;
    try {
      const res = await fetch(apiUrl(`/api/student/request/${reqId}`), { method: 'DELETE' });
      if (res.ok) {
        toast({ title: t('تم الإلغاء 🗑️', 'Cancelled 🗑️') });
        fetchMyData();
        onRefresh?.();
        setSelectedRequest(null);
      }
    } catch {
      toast({ title: t('خطأ', 'Error'), variant: 'destructive' });
    }
  };

  const activeLoans = loans.filter(l => {
    const s = (l.status || '').trim().toLowerCase();
    return s === 'نشط' || s === 'active';
  });
  const overdueLoans = loans.filter(l => {
    const s = (l.status || '').trim().toLowerCase();
    return s === 'متأخر' || s === 'overdue';
  });
  const returnedLoans = loans.filter(l => {
    const s = (l.status || '').trim().toLowerCase();
    return s !== 'نشط' && s !== 'active' && s !== 'متأخر' && s !== 'overdue';
  });
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const getDaysInfo = (dateStr: string, isOverdue: boolean) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const ret = new Date(dateStr); ret.setHours(0,0,0,0);
    const diff = Math.round((ret.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (isOverdue || diff < 0) return { days: Math.abs(diff), late: true };
    return { days: diff, late: false };
  };

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    'pending': { label: t('قيد المراجعة', 'Pending'), color: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800', icon: Clock },
    'approved': { label: t('مقبول', 'Approved'), color: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800', icon: CheckCircle2 },
    'rejected': { label: t('مرفوض', 'Rejected'), color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800', icon: XCircle },
    'partial': { label: t('موافقة جزئية', 'Partial'), color: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800', icon: AlertCircle }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black mb-1">{t('طلباتي وعهدي', 'My Requests & Loans')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('تتبع جميع طلباتك والعهد المستعارة', 'Track all your requests and borrowed items')}</p>
        </div>
        <button onClick={fetchMyData} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Overdue Banner */}
      {overdueLoans.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="font-black text-red-700 dark:text-red-400">
              {t(`تنبيه: لديك ${overdueLoans.length} عهدة متأخرة!`, `${overdueLoans.length} overdue loan(s)!`)}
            </p>
            <p className="text-sm text-red-600/80 dark:text-red-400/80">{t('يرجى التواصل مع المشرف', 'Contact the supervisor')}</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('طلبات معلقة', 'Pending'), count: pendingCount, icon: Clock, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900' },
          { label: t('عُهد نشطة', 'Active'), count: activeLoans.length, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900' },
          { label: t('متأخرة', 'Overdue'), count: overdueLoans.length, icon: AlertCircle, color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900' },
          { label: t('مُرجعة', 'Returned'), count: returnedLoans.length, icon: Archive, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-300' },
        ].map((item, idx) => (
          <div key={idx} className={`rounded-2xl border p-4 text-center hover:-translate-y-0.5 transition-all ${item.color}`}>
            <item.icon className="w-7 h-7 mx-auto mb-2 opacity-80" />
            <p className="text-2xl font-black mb-1">{item.count}</p>
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active-loans" className="w-full space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <TabsList className="flex flex-wrap h-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-sm justify-start gap-1">
          <TabsTrigger value="active-loans" className="gap-2 rounded-xl px-4 py-2.5 text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Package className="w-4 h-4" /> {t('العُهد النشطة', 'Active Loans')}
            {(activeLoans.length + overdueLoans.length) > 0 && (
              <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs">{activeLoans.length + overdueLoans.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2 rounded-xl px-4 py-2.5 text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <ShoppingBag className="w-4 h-4" /> {t('الطلبات', 'Requests')}
            {requests.length > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs">{requests.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="returned-loans" className="gap-2 rounded-xl px-4 py-2.5 text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Archive className="w-4 h-4" /> {t('السجل', 'History')}
          </TabsTrigger>
        </TabsList>

        {/* Active Loans */}
        <TabsContent value="active-loans" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {loading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[1,2].map(i => <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
            </div>
          ) : (activeLoans.length + overdueLoans.length) === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-800">
              <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-300 dark:text-emerald-700 mb-3" />
              <p className="text-lg font-black mb-1">{t('ذمتك مخلية!', 'You are all clear!')}</p>
              <p className="text-sm text-slate-500">{t('لا توجد عُهد نشطة', 'No active loans')}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {[...overdueLoans, ...activeLoans].map(loan => {
                const isOverdue = loan.status === 'متأخر' || loan.status === 'Overdue';
                const daysInfo = getDaysInfo(loan.expectedReturnDate, isOverdue);
                return (
                  <div key={loan.id} className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border flex flex-col sm:flex-row items-center gap-4 shadow-sm hover:shadow-md transition ${
                    isOverdue ? 'border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10' : 'border-emerald-200 dark:border-emerald-800'
                  }`}>
                    <div className="w-16 h-16 rounded-xl bg-slate-50 dark:bg-slate-800 p-2 shrink-0 flex items-center justify-center">
                      <img src={getImageUrl(loan.componentName)} className="max-w-full max-h-full object-contain" alt="" />
                    </div>
                    <div className="flex-1 min-w-0 text-center sm:text-start space-y-1.5">
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate">{displayCompName(loan)}</h3>
                      <p className="text-xs text-slate-400 flex items-center justify-center sm:justify-start gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> {loan.borrowDate}
                      </p>
                      <p className={`text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 w-fit mx-auto sm:mx-0 px-2.5 py-1 rounded-md ${
                        isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }`}>
                        <Clock className="w-3.5 h-3.5" /> {loan.expectedReturnDate}
                        {daysInfo.late
                          ? <span className="mr-1 font-black">({t(`متأخر ${daysInfo.days} يوم`, `${daysInfo.days}d overdue`)})</span>
                          : <span className="mr-1">({t(`${daysInfo.days} يوم`, `${daysInfo.days}d left`)})</span>
                        }
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Requests */}
        <TabsContent value="requests" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {loading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[1,2].map(i => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-800">
              <ShoppingBag className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-lg font-black mb-1">{t('لا طلبات بعد', 'No requests yet')}</p>
              <p className="text-sm text-slate-500">{t('ابدأ بتصفح المتجر', 'Browse the catalog')}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {requests.map(req => {
                const status = statusConfig[req.status] || statusConfig['pending'];
                const StatusIcon = status.icon;
                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${status.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {status.label}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">#{req.id}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> {req.requestDate}
                    </p>
                    <p className="font-bold text-sm">{req.items.length} {t('قطعة', 'items')}</p>
                    {req.status === 'pending' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCancelRequest(req.id); }}
                        className="mt-3 text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {t('إلغاء الطلب', 'Cancel')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Returned History */}
        <TabsContent value="returned-loans" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {returnedLoans.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-800">
              <Archive className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-lg font-black mb-1">{t('السجل فارغ', 'History is empty')}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {returnedLoans.map(loan => (
                <div key={loan.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4 opacity-75">
                  <div className="w-14 h-14 rounded-xl bg-slate-50 dark:bg-slate-800 p-2 shrink-0 flex items-center justify-center">
                    <img src={getImageUrl(loan.componentName)} className="max-w-full max-h-full object-contain" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{displayCompName(loan)}</h3>
                    <p className="text-xs text-slate-400 mt-1">{loan.borrowDate} → {loan.expectedReturnDate}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {loan.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Request Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-lg" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" /> {t('تفاصيل الطلب', 'Request Details')} #{selectedRequest?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs mb-1">{t('تاريخ الطلب', 'Date')}</p>
                  <p className="font-bold">{selectedRequest.requestDate}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">{t('الإرجاع المتوقع', 'Expected Return')}</p>
                  <p className="font-bold">{selectedRequest.expectedReturnDate}</p>
                </div>
              </div>
              {selectedRequest.note && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">{selectedRequest.note}</p>
                </div>
              )}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedRequest.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-lg p-1 flex items-center justify-center shrink-0">
                      <img src={getImageUrl(item.componentName)} className="max-w-full max-h-full object-contain" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{displayCompName(item)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t('مطلوب', 'Requested')}: <span className="font-bold">{item.requestedQuantity}</span>
                        {item.approvedQuantity > 0 && (
                          <> · {t('موافق', 'Approved')}: <span className="font-bold text-emerald-600">{item.approvedQuantity}</span></>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {selectedRequest.status === 'pending' && (
                <Button
                  onClick={() => handleCancelRequest(selectedRequest.id)}
                  variant="destructive"
                  className="w-full font-bold"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> {t('إلغاء الطلب', 'Cancel Request')}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
