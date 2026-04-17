import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext'; // ✅ استيراد الثيم
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowRight, ArrowLeft, Package, Calendar, Clock, ShoppingBag, CheckCircle2, AlertCircle, XCircle, Trash2, Layers, Archive, Moon, Sun, RotateCcw, MessageSquare, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '../../LanguageContext';
import { apiUrl } from '@/lib/api';

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

const MyLoans = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme(); // ✅ استخدام الثيم
  const { toast } = useToast();
  const { lang, t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [loans, setLoans] = useState<StudentLoan[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const [selectedRequest, setSelectedRequest] = useState<StudentRequest | null>(null);
  const [reqFilter, setReqFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const getNameAr = (c: RequestItem | StudentLoan) => c.name_ar || c.componentName;
  const getNameEn = (c: RequestItem | StudentLoan) => c.name_en || c.name_ar || c.componentName;
  const displayCompName = (c: RequestItem | StudentLoan) => lang === 'ar' ? getNameAr(c) : getNameEn(c);

  const fetchMyData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [dataRes, invRes] = await Promise.all([
        fetch(apiUrl(`/api/student/my-requests/${user.id}`)),
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
      toast({ title: t('خطأ', 'Error'), description: t('تعذر جلب البيانات', 'Failed to fetch data'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMyData(); }, [user]);

  const getImageUrl = (compName: string) => {
    const item = inventory.find(i => i.name === compName || i.name_ar === compName || i.name_en === compName);
    return item?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png';
  };

  const handleCancelRequest = async (reqId: number) => {
    if (!confirm(t('هل أنت متأكد من إلغاء هذا الطلب؟', 'Are you sure you want to cancel this request?'))) return;
    try {
      const res = await fetch(apiUrl(`/api/student/request/${reqId}`), { method: 'DELETE' });
      if (res.ok) {
        toast({ title: t('تم إلغاء الطلب بنجاح 🗑️', 'Request Cancelled 🗑️') });
        fetchMyData();
        setSelectedRequest(null);
      } else {
        toast({ title: t('خطأ', 'Error'), variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' });
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
    const isActive = s === 'نشط' || s === 'active';
    const isOverdue = s === 'متأخر' || s === 'overdue';
    return !isActive && !isOverdue;
  });

  const filteredRequests = requests.filter(r => reqFilter === 'all' || r.status === reqFilter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  // احسب الأيام المتبقية أو المتأخرة
  const getDaysInfo = (returnDateStr: string, isOverdue: boolean) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const ret   = new Date(returnDateStr); ret.setHours(0,0,0,0);
    const diff  = Math.round((ret.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (isOverdue || diff < 0) return { days: Math.abs(diff), late: true };
    return { days: diff, late: false };
  };

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    'pending': { label: t('قيد المراجعة', 'Pending'), color: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800', icon: Clock },
    'approved': { label: t('مقبول', 'Approved'), color: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800', icon: CheckCircle2 },
    'rejected': { label: t('مرفوض', 'Rejected'), color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800', icon: XCircle },
    'partial': { label: t('موافقة جزئية', 'Partial'), color: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800', icon: AlertCircle }
  };

  const SkeletonLoader = () => (
    <div className="grid md:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex gap-4 animate-pulse">
          <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-xl shrink-0"></div>
          <div className="flex-1 space-y-3 py-1"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div><div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={`min-h-screen font-sans pb-20 transition-colors ${theme === 'dark' ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-sm transition-colors">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors" onClick={() => navigate('/student')}>
              {lang === 'ar' ? <ArrowRight className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
            </Button>
            <h1 className="font-black text-xl text-slate-800 dark:text-white">{t('طلباتي وعهدي', 'My Requests & Loans')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchMyData} title={t('تحديث', 'Refresh')} className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-inner">
              <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={toggleTheme} className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-inner">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-sm shadow-inner">{user?.name?.charAt(0) || 'U'}</div>
              <span className="font-bold text-sm text-slate-700 dark:text-slate-300 hidden sm:block">{user?.name}</span>
              <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 hidden md:block">{user?.id}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-8">

        {/* 🔴 بانر تحذير العهد المتأخرة */}
        {overdueLoans.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-2xl p-4 flex items-center gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 animate-pulse"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-red-700 dark:text-red-400 text-base">
                {t(`تنبيه: لديك ${overdueLoans.length} عهدة متأخرة!`, `Warning: You have ${overdueLoans.length} overdue loan(s)!`)}
              </p>
              <p className="text-sm text-red-600/80 dark:text-red-400/80 font-medium mt-0.5">
                {t('يرجى التواصل مع المشرف لتسوية الوضع في أقرب وقت.', 'Please contact the supervisor to resolve this as soon as possible.')}
              </p>
            </div>
          </div>
        )}

        {/* 🌟 إحصائيات سريعة */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t('طلبات معلقة', 'Pending'), count: pendingCount, icon: Clock, color: 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-900 shadow-orange-100/50 dark:shadow-none' },
            { label: t('عُهد نشطة', 'Active Loans'), count: activeLoans.length, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900 shadow-emerald-100/50 dark:shadow-none' },
            { label: t('عُهد متأخرة', 'Overdue'), count: overdueLoans.length, icon: AlertCircle, color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900 shadow-red-100/50 dark:shadow-none' },
            { label: t('عُهد مُرجعة', 'Returned'), count: returnedLoans.length, icon: Archive, color: 'text-slate-600 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 shadow-slate-200/50 dark:shadow-none' },
          ].map((item, idx) => (
            <div key={idx} className={`rounded-2xl border p-5 flex flex-col items-center text-center shadow-sm hover:-translate-y-1 transition-all duration-300 ${item.color}`}>
              <item.icon className="w-8 h-8 mb-2 opacity-80" />
              <p className="text-3xl font-black mb-1">{item.count}</p>
              <p className="text-xs font-bold uppercase tracking-wider opacity-80">{item.label}</p>
            </div>
          ))}
        </div>

        {/* 🌟 التبويبات */}
        <Tabs defaultValue="active-loans" className="w-full space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <TabsList className="flex flex-wrap h-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-sm justify-start gap-1">
            <TabsTrigger value="active-loans" className="gap-2 rounded-xl px-5 py-3 text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white dark:data-[state=inactive]:text-slate-400 transition-all">
              <Package className="w-4 h-4" /> {t('العُهد النشطة', 'Active Loans')}
              {(activeLoans.length + overdueLoans.length) > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs">{activeLoans.length + overdueLoans.length}</span>}
            </TabsTrigger>

            <TabsTrigger value="requests" className="gap-2 rounded-xl px-5 py-3 text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white dark:data-[state=inactive]:text-slate-400 transition-all">
              <ShoppingBag className="w-4 h-4" /> {t('طلبات الاستعارة', 'Requests')}
              {requests.length > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs">{requests.length}</span>}
            </TabsTrigger>

            <TabsTrigger value="returned-loans" className="gap-2 rounded-xl px-5 py-3 text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white dark:data-[state=inactive]:text-slate-400 transition-all">
              <Archive className="w-4 h-4" /> {t('سجل المُرجعات', 'History')}
            </TabsTrigger>
          </TabsList>

          {/* 📦 1. العُهد النشطة */}
          <TabsContent value="active-loans" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {loading ? <SkeletonLoader /> : (activeLoans.length + overdueLoans.length) === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 shadow-sm">
                <CheckCircle2 className="w-20 h-20 mx-auto text-emerald-200 dark:text-emerald-800 mb-4" />
                <p className="text-slate-600 dark:text-slate-300 font-black text-xl mb-2">{t('ذمتك مخلية!', 'You are all clear!')}</p>
                <p className="text-slate-400 dark:text-slate-500 font-bold text-sm mb-6">{t('لا توجد عُهد نشطة أو متأخرة في حسابك حالياً.', 'No active or overdue loans in your account.')}</p>
                <Button className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 font-bold shadow-sm h-12 px-6" onClick={() => navigate('/student')}>{t('تصفح المعمل واطلب جديد', 'Browse & Request New')}</Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {[...overdueLoans, ...activeLoans].map(loan => {
                  const isOverdue = loan.status === 'متأخر' || loan.status === 'Overdue';
                  const daysInfo = getDaysInfo(loan.expectedReturnDate, isOverdue);
                  return (
                    <div key={loan.id} className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border flex flex-col sm:flex-row items-center gap-4 transition-all shadow-sm hover:shadow-md ${isOverdue ? 'border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10' : 'border-emerald-200 dark:border-emerald-800'}`}>
                      <div className="w-20 h-20 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 shrink-0 flex items-center justify-center">
                        <img src={getImageUrl(loan.componentName)} className="max-w-full max-h-full object-contain" alt="" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }} />
                      </div>

                      <div className="flex-1 min-w-0 text-center sm:text-start w-full space-y-1.5">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg truncate">{displayCompName(loan)}</h3>
                        {/* تاريخ الاستعارة */}
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium flex items-center justify-center sm:justify-start gap-1.5">
                          <Calendar className="w-3.5 h-3.5 shrink-0"/> {t('استُلمت:', 'Borrowed:')} {loan.borrowDate}
                        </p>
                        {/* تاريخ الإرجاع + عداد الأيام */}
                        <p className={`text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 w-fit sm:w-auto mx-auto sm:mx-0 px-2.5 py-1 rounded-md ${isOverdue ? 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' : 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'}`}>
                          <Clock className="w-3.5 h-3.5"/> {loan.expectedReturnDate}
                          {daysInfo.late
                            ? <span className="mr-1 font-black text-red-600 dark:text-red-400">({t(`متأخر ${daysInfo.days} يوم`, `${daysInfo.days}d overdue`)})</span>
                            : daysInfo.days <= 3
                              ? <span className="mr-1 font-black text-orange-500">({t(`باقي ${daysInfo.days} أيام`, `${daysInfo.days}d left`)})</span>
                              : <span className="mr-1 text-emerald-600 dark:text-emerald-400">({t(`باقي ${daysInfo.days} يوم`, `${daysInfo.days}d left`)})</span>
                          }
                        </p>
                      </div>

                      <div className="shrink-0 bg-slate-50 dark:bg-slate-950 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner text-center w-full sm:w-auto">
                         <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-bold mb-0.5 uppercase tracking-wide">{t('الكمية', 'Qty')}</span>
                         <span className="block text-slate-800 dark:text-white font-black text-2xl leading-none">{loan.quantity}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* 🛍️ 2. تبويب طلبات الاستعارة */}
          <TabsContent value="requests" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex gap-2 mb-4 bg-white dark:bg-slate-900 p-2 rounded-xl border dark:border-slate-800 shadow-sm w-fit overflow-x-auto custom-scrollbar flex-wrap">
              <button onClick={() => setReqFilter('all')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${reqFilter==='all'?'bg-slate-700 dark:bg-slate-700 text-white shadow-sm':'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{t('الكل', 'All')} ({requests.length})</button>
              <button onClick={() => setReqFilter('pending')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${reqFilter==='pending'?'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 shadow-sm border border-orange-200 dark:border-orange-800':'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{t('معلقة', 'Pending')} ({requests.filter(r=>r.status==='pending').length})</button>
              <button onClick={() => setReqFilter('approved')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${reqFilter==='approved'?'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-sm border border-emerald-200 dark:border-emerald-800':'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{t('مقبولة', 'Approved')} ({requests.filter(r=>r.status==='approved').length})</button>
              <button onClick={() => setReqFilter('rejected')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${reqFilter==='rejected'?'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 shadow-sm border border-red-200 dark:border-red-800':'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{t('مرفوضة', 'Rejected')} ({requests.filter(r=>r.status==='rejected').length})</button>
            </div>

            {loading ? <SkeletonLoader /> : filteredRequests.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 shadow-sm">
                <ShoppingBag className="w-16 h-16 mx-auto text-slate-200 dark:text-slate-700 mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-bold text-lg">{t('لا توجد طلبات في هذا التصنيف', 'No matching requests')}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {filteredRequests.map(req => {
                  const StatusIcon = statusConfig[req.status]?.icon || Clock;
                  return (
                    <Card key={req.id} onClick={() => setSelectedRequest(req)} className="cursor-pointer border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg transition-all rounded-2xl overflow-hidden group bg-white dark:bg-slate-900">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                            <Calendar className="w-4 h-4 text-blue-500" /> {req.requestDate}
                          </div>
                          <span className={`text-[11px] font-black px-3 py-1.5 rounded-lg border flex items-center gap-1.5 shadow-sm ${statusConfig[req.status]?.color || 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                            <StatusIcon className="w-3.5 h-3.5"/> {statusConfig[req.status]?.label || req.status}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-1.5"><Layers className="w-4 h-4"/> {t('القطع المطلوبة:', 'Requested Items:')}</p>
                        <div className="flex flex-wrap gap-2">
                          {req.items.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 pr-2 pl-1 py-1.5 rounded-xl shadow-sm">
                              <div className="w-6 h-6 bg-white dark:bg-slate-900 rounded-md overflow-hidden p-0.5 border border-slate-100 dark:border-slate-800"><img src={getImageUrl(item.componentName)} className="w-full h-full object-contain" alt="" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }} /></div>
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 max-w-[90px] truncate">{displayCompName(item)}</span>
                              <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800">x{item.requestedQuantity}</span>
                            </div>
                          ))}
                          {req.items.length > 3 && (
                            <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              +{req.items.length - 3} {t('عناصر', 'items')}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* 🗃️ 3. سجل المُرجعات */}
          <TabsContent value="returned-loans" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {loading ? <SkeletonLoader /> : returnedLoans.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 shadow-sm">
                <Archive className="w-20 h-20 mx-auto text-slate-200 dark:text-slate-700 mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-bold text-lg">{t('لا يوجد سجل للقطع المرجعة', 'No returned items history')}</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {returnedLoans.map(loan => (
                    <div key={loan.id} className="p-4 flex flex-col sm:flex-row items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors opacity-80 hover:opacity-100">
                      <div className="w-14 h-14 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-1.5 shrink-0">
                        <img src={getImageUrl(loan.componentName)} className="max-w-full max-h-full object-contain grayscale" alt="" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }} />
                      </div>

                      <div className="flex-1 min-w-0 text-center sm:text-start">
                        <h3 className="font-bold text-slate-700 dark:text-slate-300 text-base truncate mb-1">{displayCompName(loan)}</h3>
                        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                          {t('تاريخ الاستعارة:', 'Borrowed:')} {loan.borrowDate}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-3 w-full sm:w-auto justify-center">
                         <span className="text-xs font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border dark:border-slate-700">x{loan.quantity}</span>
                         <span className="text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg border dark:border-slate-700 flex items-center gap-1.5">
                           <CheckCircle2 className="w-3.5 h-3.5"/> {t('تم الإرجاع', 'Returned')}
                         </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

        </Tabs>
      </main>

      {/* 🌟 تفاصيل الطلب */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        {selectedRequest && (
          <DialogContent className="max-w-md p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <DialogHeader className="bg-slate-50 dark:bg-slate-950 p-6 border-b border-slate-100 dark:border-slate-800">
              <DialogTitle className="text-xl font-black text-slate-800 dark:text-white flex items-center justify-between">
                {t('تفاصيل الطلب', 'Request Details')}
                <span className={`text-xs font-black px-3 py-1.5 rounded-lg border flex items-center gap-1.5 shadow-sm ${statusConfig[selectedRequest.status]?.color}`}>
                  {statusConfig[selectedRequest.status]?.label || selectedRequest.status}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="p-6 bg-slate-50/30 dark:bg-slate-900/50">
              <div className="space-y-3 mb-5">
                <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2"><Calendar className="w-5 h-5 text-orange-500" /> {t('تاريخ الإرجاع المتوقع:', 'Expected Return:')}</span>
                  <span className="font-black text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-3 py-1 rounded-lg border border-orange-100 dark:border-orange-800">{selectedRequest.expectedReturnDate}</span>
                </div>
                {selectedRequest.note && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium leading-relaxed">{selectedRequest.note}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-blue-500"/> {t('قائمة القطع المطلوبة', 'Requested Items List')}</h4>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                  {selectedRequest.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm hover:border-blue-200 dark:hover:border-blue-500 transition-colors group">
                      <div className="w-14 h-14 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1.5 shrink-0 flex items-center justify-center">
                        <img src={getImageUrl(item.componentName)} className="max-w-full max-h-full object-contain" alt="" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{displayCompName(item)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                         <span className="text-xs font-black text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 px-3 py-1 rounded-lg">x{item.requestedQuantity}</span>
                         {selectedRequest.status === 'approved' && <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded"><CheckCircle2 className="w-3 h-3"/> {t('معتمد', 'Apprvd')}</span>}
                         {selectedRequest.status === 'rejected' && <span className="text-[9px] font-bold text-red-600 dark:text-red-400 flex items-center gap-0.5 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded"><XCircle className="w-3 h-3"/> {t('مرفوض', 'Rjctd')}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-row gap-3 justify-between items-center shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
              <div className="flex gap-2">
                {selectedRequest.status === 'pending' && (
                  <Button variant="outline" onClick={() => handleCancelRequest(selectedRequest.id)} className="font-bold flex items-center gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/30 h-11">
                    <Trash2 className="w-4 h-4" /> {t('إلغاء', 'Cancel')}
                  </Button>
                )}
                {selectedRequest.status === 'rejected' && (
                  <Button variant="outline"
                    onClick={() => { setSelectedRequest(null); navigate('/student'); }}
                    className="font-bold flex items-center gap-2 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 h-11">
                    <RotateCcw className="w-4 h-4" /> {t('إعادة الطلب', 'Re-request')}
                  </Button>
                )}
              </div>
              <Button onClick={() => setSelectedRequest(null)} className="font-bold bg-slate-800 dark:bg-slate-800 hover:bg-slate-900 dark:hover:bg-slate-700 text-white shadow-md h-11 px-8">{t('إغلاق', 'Close')}</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

    </div>
  );
};

export default MyLoans;