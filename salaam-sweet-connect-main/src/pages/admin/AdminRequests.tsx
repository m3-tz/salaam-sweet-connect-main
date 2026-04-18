import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2, XCircle, Clock, UserPlus, ShoppingBag,
  BadgeCheck, Trash2, Printer, MessageCircle, Eye, Calendar,
  Layers, MapPin, Tag, AlertTriangle, Search, Mail, Phone,
  GraduationCap, Hash, BookOpen, CheckSquare, Square, FileDown
} from 'lucide-react';
import LocationBadge from '@/components/LocationBadge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '../../LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiUrl } from '@/lib/api';

interface RegistrationRequest {
  id: number;
  name: string;
  universityId: string;
  phone?: string;
  email?: string;
  role: string;
  requestDate: string;
  status: string;
  batch_id?: number;
  batch_name?: string;
  batch_code?: string;
  expectedAcademicId?: string;
}

interface CartRequestItem {
  componentName: string;
  name_ar?: string;
  name_en?: string;
  requestedQuantity: number;
}

interface CartRequest {
  id: number;
  studentId: string;
  studentName: string;
  expectedReturnDate: string;
  requestDate: string;
  status: string;
  items: CartRequestItem[];
  note?: string;
}

interface InventoryItem {
  name?: string;
  name_ar?: string;
  name_en?: string;
  quantity: number;
  location: string;
  category?: string;
  category_ar?: string;
  category_en?: string;
  imageUrl: string;
}

// حالة كل قطعة في نافذة المراجعة
interface ItemDecision {
  approved: boolean;
  approvedQty: number;
}

// ─── PDF generator ────────────────────────────────────────────────────────────
const generateLoanPDF = (
  req: CartRequest,
  decisions: Record<string, ItemDecision>,
  adminComment: string,
  isAr: boolean
) => {
  const approvedItems = req.items.filter(
    item => decisions[item.componentName]?.approved && decisions[item.componentName].approvedQty > 0
  );
  const rejectedItems = req.items.filter(
    item => !decisions[item.componentName]?.approved || decisions[item.componentName].approvedQty === 0
  );

  const today = new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US');
  const time  = new Date().toLocaleTimeString(isAr ? 'ar-SA' : 'en-US');

  const html = `<!DOCTYPE html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
<head>
  <meta charset="UTF-8"/>
  <title>${isAr ? 'سند عهدة' : 'Loan Receipt'} #${req.id}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Tajawal',sans-serif;padding:30px 40px;color:#0f172a;background:#fff;font-size:14px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:24px}
    .header-title{font-size:22px;font-weight:900;color:#1d4ed8}
    .header-sub{font-size:12px;color:#64748b;margin-top:4px}
    .badge{display:inline-flex;align-items:center;gap:6px;background:#dcfce7;color:#166534;border:1px solid #86efac;padding:4px 12px;border-radius:20px;font-weight:700;font-size:13px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}
    .info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px}
    .info-label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
    .info-value{font-weight:700;color:#0f172a;font-size:15px}
    .section-title{font-size:13px;font-weight:900;color:#334155;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;display:flex;align-items:center;gap:6px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px}
    th{background:#f1f5f9;padding:10px 14px;text-align:${isAr ? 'right' : 'left'};font-weight:700;color:#475569;border-bottom:2px solid #e2e8f0}
    td{padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#0f172a}
    .approved-row{background:#f0fdf4}
    .rejected-row{background:#fff5f5;color:#991b1b}
    .qty-badge{display:inline-block;background:#dbeafe;color:#1d4ed8;border-radius:6px;padding:2px 10px;font-weight:900;font-size:13px}
    .comment-box{background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:14px;margin-bottom:20px}
    .comment-label{font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:6px}
    .comment-text{color:#78350f;font-size:13px;font-weight:500}
    .sign-section{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:30px;border-top:1px dashed #cbd5e1;padding-top:20px}
    .sign-box{text-align:center}
    .sign-label{font-size:11px;font-weight:700;color:#64748b;margin-bottom:30px}
    .sign-line{border-top:1px solid #0f172a;width:80%;margin:0 auto;padding-top:6px;font-size:11px;color:#64748b}
    .footer{text-align:center;margin-top:24px;color:#94a3b8;font-size:11px}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-title">🏫 ${isAr ? 'معمل الهندسة والابتكار' : 'Engineering & Innovation Lab'}</div>
      <div class="header-sub">${isAr ? 'سند عهدة رقم' : 'Loan Receipt No.'} #${req.id}</div>
    </div>
    <div class="badge">✅ ${isAr ? 'تم الاعتماد' : 'Approved'}</div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">${isAr ? 'اسم الطالب' : 'Student Name'}</div>
      <div class="info-value">${req.studentName}</div>
    </div>
    <div class="info-box">
      <div class="info-label">${isAr ? 'الرقم الأكاديمي' : 'Academic ID'}</div>
      <div class="info-value" style="font-family:monospace">${req.studentId}</div>
    </div>
    <div class="info-box">
      <div class="info-label">${isAr ? 'تاريخ الطلب' : 'Request Date'}</div>
      <div class="info-value">${req.requestDate}</div>
    </div>
    <div class="info-box">
      <div class="info-label">${isAr ? 'تاريخ الإرجاع المتوقع' : 'Expected Return'}</div>
      <div class="info-value" style="color:#ea580c">${req.expectedReturnDate}</div>
    </div>
  </div>

  ${approvedItems.length > 0 ? `
  <div class="section-title">✅ ${isAr ? 'القطع المعتمدة' : 'Approved Items'}</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>${isAr ? 'اسم القطعة' : 'Item Name'}</th>
        <th>${isAr ? 'الكمية المطلوبة' : 'Requested'}</th>
        <th>${isAr ? 'الكمية المعتمدة' : 'Approved'}</th>
      </tr>
    </thead>
    <tbody>
      ${approvedItems.map((item, i) => `
      <tr class="approved-row">
        <td>${i + 1}</td>
        <td><strong>${item.componentName}</strong></td>
        <td>${item.requestedQuantity}</td>
        <td><span class="qty-badge">${decisions[item.componentName]?.approvedQty ?? item.requestedQuantity}</span></td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${rejectedItems.length > 0 ? `
  <div class="section-title">❌ ${isAr ? 'القطع المرفوضة' : 'Rejected Items'}</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>${isAr ? 'اسم القطعة' : 'Item Name'}</th>
        <th>${isAr ? 'الكمية المطلوبة' : 'Requested'}</th>
      </tr>
    </thead>
    <tbody>
      ${rejectedItems.map((item, i) => `
      <tr class="rejected-row">
        <td>${i + 1}</td>
        <td>${item.componentName}</td>
        <td>${item.requestedQuantity}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${adminComment ? `
  <div class="comment-box">
    <div class="comment-label">💬 ${isAr ? 'ملاحظة المشرف' : 'Admin Comment'}</div>
    <div class="comment-text">${adminComment}</div>
  </div>` : ''}

  <div class="sign-section">
    <div class="sign-box">
      <div class="sign-label">${isAr ? 'توقيع المشرف' : 'Admin Signature'}</div>
      <div class="sign-line">${isAr ? 'الاسم والتوقيع' : 'Name & Signature'}</div>
    </div>
    <div class="sign-box">
      <div class="sign-label">${isAr ? 'توقيع الطالب' : 'Student Signature'}</div>
      <div class="sign-line">${req.studentName}</div>
    </div>
  </div>

  <div class="footer">${isAr ? 'طُبع بتاريخ' : 'Printed on'} ${today} — ${time}</div>
  <script>setTimeout(()=>{window.print();},400)</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
};

// ─────────────────────────────────────────────────────────────────────────────

const AdminRequests = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'مشرف' || user?.role?.toLowerCase() === 'admin';

  const { lang, t } = useLanguage();
  const { toast } = useToast();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<'registration' | 'cart'>(isSuperAdmin ? 'registration' : 'cart');
  const [regRequests, setRegRequests] = useState<RegistrationRequest[]>([]);
  const [cartRequests, setCartRequests] = useState<CartRequest[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCartReq, setSelectedCartReq]   = useState<CartRequest | null>(null);
  const [selectedRegReq, setSelectedRegReq]     = useState<RegistrationRequest | null>(null);
  const [historyFilter, setHistoryFilter]       = useState<'all' | 'approved' | 'rejected'>('all');
  const [processingRegIds, setProcessingRegIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery]           = useState('');

  // ── حالة قرار كل قطعة ──────────────────────────────────────────────────────
  const [itemDecisions, setItemDecisions] = useState<Record<string, ItemDecision>>({});
  const [adminComment, setAdminComment]   = useState('');
  const [submitting, setSubmitting]       = useState(false);

  const translateRole = (role: string) => {
    const r = role.toLowerCase();
    if (r === 'student'  || r === 'طالب')  return t('طالب', 'Student');
    if (r === 'engineer' || r === 'مهندس') return t('مهندس', 'Engineer');
    if (r === 'admin'    || r === 'مشرف')  return t('مشرف', 'Admin');
    return role;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [regRes, cartRes, invRes] = await Promise.all([
        fetch(apiUrl('/api/requests/registration')),
        fetch(apiUrl('/api/requests/cart')),
        fetch(apiUrl('/api/items'))
      ]);
      if (regRes.ok)  setRegRequests((await regRes.json()).data);
      if (cartRes.ok) setCartRequests((await cartRes.json()).data);
      if (invRes.ok)  setInventoryItems((await invRes.json()).data);
    } catch {
      toast({ title: t('خطأ', 'Error'), description: t('لا يمكن الاتصال بالخادم', 'Cannot connect to server'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // عند فتح نافذة المراجعة نُهيّئ قرار كل قطعة بالقبول الكامل افتراضياً
  const openCartDialog = (req: CartRequest) => {
    const init: Record<string, ItemDecision> = {};
    req.items.forEach(item => {
      init[item.componentName] = { approved: true, approvedQty: item.requestedQuantity };
    });
    setItemDecisions(init);
    setAdminComment('');
    setSelectedCartReq(req);
  };

  const getInventoryDetails = (componentName: string) =>
    inventoryItems.find(item =>
      item.name === componentName || item.name_ar === componentName || item.name_en === componentName
    );

  const handleRegAction = async (id: number, status: 'approved' | 'rejected') => {
    if (processingRegIds.has(id)) return;
    setProcessingRegIds(prev => new Set(prev).add(id));
    try {
      const res  = await fetch(apiUrl(`/api/requests/registration/${id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminId: user?.id, adminName: user?.name })
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: status === 'approved' ? t('تم قبول الطالب ✅', 'Student approved ✅') : t('تم رفض الطلب ❌', 'Request rejected ❌') });
        setSelectedRegReq(null);
        fetchData();
      } else {
        console.error('[handleRegAction]', data);
        toast({ title: t('خطأ من السيرفر', 'Server Error'), description: data.message, variant: 'destructive' });
      }
    } catch (err) {
      console.error('[handleRegAction] network:', err);
      toast({ title: t('خطأ', 'Error'), description: t('فشل الاتصال', 'Connection failed'), variant: 'destructive' });
    } finally {
      setProcessingRegIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  // ── إرسال قرار العهدة مع القطع المختارة ──────────────────────────────────
  const handleCartDecision = async (globalStatus: 'approved' | 'rejected') => {
    if (!selectedCartReq) return;
    setSubmitting(true);

    const approvedList = selectedCartReq.items
      .filter(item => itemDecisions[item.componentName]?.approved && itemDecisions[item.componentName].approvedQty > 0)
      .map(item => ({
        componentName:    item.componentName,
        approvedQuantity: itemDecisions[item.componentName].approvedQty
      }));

    const finalStatus = globalStatus === 'rejected'
      ? 'rejected'
      : approvedList.length === 0
        ? 'rejected'
        : approvedList.length < selectedCartReq.items.length
          ? 'partial'
          : 'approved';

    try {
      const res  = await fetch(apiUrl(`/api/requests/cart/${selectedCartReq.id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status:             finalStatus,
          expectedReturnDate: selectedCartReq.expectedReturnDate,
          items:              finalStatus === 'rejected' ? selectedCartReq.items.map(i => ({ componentName: i.componentName, approvedQuantity: 0 })) : approvedList,
          adminId:            user?.id,
          adminName:          user?.name,
          adminComment
        })
      });
      const data = await res.json();
      if (res.ok) {
        // السند يُرسل عبر الإيميل تلقائياً من الباك إند
        if (finalStatus !== 'rejected') {
          toast({
            title: t('تم الاعتماد ✅', 'Approved ✅'),
            description: t('تم إرسال سند العهدة للطالب عبر الإيميل تلقائياً 📧', 'Loan receipt sent to student via email 📧')
          });
        } else {
          toast({ title: t('تم الرفض ❌', 'Rejected ❌') });
        }
        setSelectedCartReq(null);
        fetchData();
      } else {
        toast({ title: t('خطأ', 'Error'), description: data.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ', 'Error'), description: t('فشل الاتصال', 'Connection failed'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOldRequest = async (type: 'reg' | 'cart', id: number) => {
    if (!confirm(t('هل أنت متأكد من الحذف النهائي؟', 'Permanently delete this record?'))) return;
    const endpoint = type === 'reg' ? apiUrl(`/api/requests/registration/${id}`) : apiUrl(`/api/requests/cart/${id}`);
    try {
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') }
      });
      if (res.ok) { toast({ title: t('تم الحذف 🗑️', 'Deleted 🗑️') }); fetchData(); }
    } catch {
      toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' });
    }
  };

  const formatPhoneForWA = (phone?: string) => {
    if (!phone) return '';
    const c = phone.replace(/\D/g, '');
    return c.startsWith('0') ? `966${c.slice(1)}` : c;
  };

  const handlePrintCartRequest = (req: CartRequest) => {
    const decs: Record<string, ItemDecision> = {};
    req.items.forEach(i => { decs[i.componentName] = { approved: true, approvedQty: i.requestedQuantity }; });
    generateLoanPDF(req, decs, '', lang === 'ar');
  };

  const filterBySearch = (item: { name?: string; studentName?: string; universityId?: string; studentId?: string }) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (item.name || item.studentName || '').toLowerCase().includes(q)
        || (item.universityId || item.studentId || '').toLowerCase().includes(q);
  };

  const pendingReg  = regRequests.filter(r => r.status === 'pending' && filterBySearch(r));
  const pastReg     = regRequests.filter(r => r.status !== 'pending' && (historyFilter === 'all' || r.status === historyFilter) && filterBySearch(r));
  const pendingCart = cartRequests.filter(r => r.status === 'pending' && filterBySearch(r));
  const pastCart    = cartRequests.filter(r => r.status !== 'pending' && (historyFilter === 'all' || r.status === historyFilter) && filterBySearch(r));

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'pending')  return <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-orange-200 dark:border-orange-800"><Clock className="w-3.5 h-3.5"/>{t('معلق','Pending')}</span>;
    if (status === 'approved') return <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800"><BadgeCheck className="w-3.5 h-3.5"/>{t('مقبول','Approved')}</span>;
    if (status === 'partial')  return <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-blue-200 dark:border-blue-800"><CheckCircle2 className="w-3.5 h-3.5"/>{t('جزئي','Partial')}</span>;
    return <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-red-200 dark:border-red-800"><XCircle className="w-3.5 h-3.5"/>{t('مرفوض','Rejected')}</span>;
  };

  const SkeletonLoader = () => (
    <div className="space-y-4 w-full">
      {[1,2,3].map(i => (
        <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 animate-pulse">
          <div className="w-14 h-14 bg-slate-200 dark:bg-slate-700 rounded-full shrink-0"/>
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"/>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4"/>
          </div>
          <div className="w-24 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl shrink-0"/>
        </div>
      ))}
    </div>
  );

  const InfoRow = ({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value?: string | null; highlight?: boolean }) => (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${highlight ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
      <span className={`shrink-0 ${highlight ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">{label}</p>
        <p className={`font-bold text-sm break-words ${highlight ? 'text-blue-800 dark:text-blue-300 font-mono text-base' : 'text-slate-800 dark:text-slate-200'} ${!value ? 'text-slate-400 dark:text-slate-600 italic font-normal' : ''}`}>
          {value || t('—','—')}
        </p>
      </div>
    </div>
  );

  // ── حساب ملخص القرار الحالي ──────────────────────────────────────────────
  const approvedCount  = selectedCartReq ? selectedCartReq.items.filter(i => itemDecisions[i.componentName]?.approved && itemDecisions[i.componentName]?.approvedQty > 0).length : 0;
  const totalItemCount = selectedCartReq?.items.length ?? 0;
  const allApproved    = approvedCount === totalItemCount;
  const allRejected    = approvedCount === 0;

  return (
    <div className="space-y-6 font-sans pb-10" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
        <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
          <BadgeCheck className="w-7 h-7 text-blue-600"/> {t('إدارة الطلبات المعلقة','Pending Requests Management')}
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`}/>
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('بحث بالاسم أو الرقم...','Search name or ID...')}
              className={`${lang === 'ar' ? 'pr-9' : 'pl-9'} bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-11 rounded-xl dark:text-white`}/>
          </div>
          <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-xl w-fit">
            {isSuperAdmin && (
              <button onClick={() => { setActiveTab('registration'); setSearchQuery(''); }}
                className={`px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab==='registration' ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                <UserPlus className="w-4 h-4"/> {t('التسجيل','Registration')}
                {regRequests.filter(r=>r.status==='pending').length > 0 && <span className="bg-red-500 text-white px-2 py-0.5 rounded-md text-[10px] animate-pulse">{regRequests.filter(r=>r.status==='pending').length}</span>}
              </button>
            )}
            <button onClick={() => { setActiveTab('cart'); setSearchQuery(''); }}
              className={`px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab==='cart' ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
              <ShoppingBag className="w-4 h-4"/> {t('طلبات العهد','Loan Requests')}
              {cartRequests.filter(r=>r.status==='pending').length > 0 && <span className="bg-red-500 text-white px-2 py-0.5 rounded-md text-[10px] animate-pulse">{cartRequests.filter(r=>r.status==='pending').length}</span>}
            </button>
          </div>
        </div>
      </div>

      {loading ? <SkeletonLoader/> : (
        <>
          {/* ══════════════ طلبات التسجيل ══════════════ */}
          {activeTab === 'registration' && isSuperAdmin && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {pendingReg.length === 0 && pastReg.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
                  <UserPlus className="w-20 h-20 text-slate-200 dark:text-slate-700 mx-auto mb-4"/>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xl">{searchQuery ? t('لا نتائج','No results') : t('لا توجد طلبات تسجيل','No registration requests')}</p>
                </div>
              ) : (
                <>
                  {pendingReg.length > 0 && (
                    <section>
                      <h3 className="text-lg font-black text-orange-600 dark:text-orange-500 mb-4 flex items-center gap-2 border-b border-orange-100 dark:border-slate-800 pb-2">
                        <Clock className="w-5 h-5"/> {t('الطلبات الجديدة','New Requests (Action Required)')}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {pendingReg.map(req => (
                          <Card key={req.id} className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-slate-900 hover:shadow-lg hover:-translate-y-1 hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-300 rounded-2xl overflow-hidden">
                            <CardContent className="p-0 flex flex-col h-full">
                              <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-xl shrink-0">{req.name.charAt(0)}</div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-black text-slate-800 dark:text-slate-200 text-base leading-tight">{req.name}</h4>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded">{translateRole(req.role)}</span>
                                    <span className="text-slate-400 dark:text-slate-500 text-[10px]"><Clock className="w-3 h-3 inline"/> {req.requestDate}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="p-4 space-y-2.5 flex-1">
                                {req.expectedAcademicId && (
                                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center gap-3">
                                    <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0"/>
                                    <div>
                                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">{t('الرقم الأكاديمي المتوقع','Expected Academic ID')}</p>
                                      <p className="font-black text-emerald-800 dark:text-emerald-300 text-lg font-mono">{req.expectedAcademicId}</p>
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-2">
                                  <Hash className="w-4 h-4 text-slate-400 shrink-0"/>
                                  <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{t('الرقم المُدخل','Entered ID')}</p>
                                    <p className="font-mono font-bold text-slate-700 dark:text-slate-300 text-sm">{req.universityId || '—'}</p>
                                  </div>
                                </div>
                                {req.batch_name && (
                                  <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 rounded-lg px-3 py-2">
                                    <BookOpen className="w-4 h-4 text-blue-500 shrink-0"/>
                                    <div>
                                      <p className="text-[10px] font-bold text-blue-400 uppercase">{t('الدفعة','Batch')}</p>
                                      <p className="font-bold text-blue-700 dark:text-blue-300 text-sm">{req.batch_name}</p>
                                    </div>
                                  </div>
                                )}
                                {req.phone && (
                                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-2">
                                    <Phone className="w-4 h-4 text-slate-400 shrink-0"/>
                                    <p className="font-mono text-slate-700 dark:text-slate-300 text-sm" dir="ltr">{req.phone}</p>
                                  </div>
                                )}
                                {req.email && (
                                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-2 min-w-0">
                                    <Mail className="w-4 h-4 text-slate-400 shrink-0"/>
                                    <p className="text-slate-600 dark:text-slate-400 text-xs truncate">{req.email}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2 p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                                <Button onClick={() => handleRegAction(req.id,'approved')} disabled={processingRegIds.has(req.id)}
                                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 h-10 disabled:opacity-60">
                                  <CheckCircle2 className="w-4 h-4"/>
                                  {processingRegIds.has(req.id) ? t('جاري...','Processing...') : t('قبول','Approve')}
                                </Button>
                                <Button onClick={() => handleRegAction(req.id,'rejected')} disabled={processingRegIds.has(req.id)}
                                  variant="outline" className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 h-10 disabled:opacity-60">
                                  <XCircle className="w-4 h-4"/>
                                </Button>
                                <Button onClick={() => setSelectedRegReq(req)} variant="secondary"
                                  className="px-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 h-10">
                                  <Eye className="w-4 h-4"/>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </section>
                  )}

                  {(pastReg.length > 0 || historyFilter !== 'all') && (
                    <section className="pt-6 border-t border-slate-200 dark:border-slate-800 mt-8">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                        <h3 className="font-black text-slate-700 dark:text-slate-300 text-lg flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500"/> {t('السجل السابق','Past Requests')}</h3>
                        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                          {(['all','approved','rejected'] as const).map(f => (
                            <button key={f} onClick={() => setHistoryFilter(f)}
                              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${historyFilter===f ? (f==='approved'?'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400':f==='rejected'?'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400':'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm') : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                              {f==='all'?t('الكل','All'):f==='approved'?t('المقبولة','Approved'):t('المرفوضة','Rejected')}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pastReg.map(req => (
                          <div key={req.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{req.name}</p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{req.universityId} • {req.requestDate}</p>
                                {req.batch_name && <p className="text-[10px] text-blue-500 mt-0.5">{req.batch_name}</p>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <StatusBadge status={req.status}/>
                                <button onClick={() => handleDeleteOldRequest('reg', req.id)}
                                  className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all">
                                  <Trash2 className="w-4 h-4"/>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══════════════ طلبات العهد ══════════════ */}
          {activeTab === 'cart' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {pendingCart.length === 0 && pastCart.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
                  <ShoppingBag className="w-20 h-20 text-slate-200 dark:text-slate-700 mx-auto mb-4"/>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xl">{searchQuery ? t('لا نتائج','No results') : t('لا توجد طلبات عهد','No loan requests')}</p>
                </div>
              ) : (
                <>
                  {pendingCart.length > 0 && (
                    <section>
                      <h3 className="text-lg font-black text-blue-600 dark:text-blue-500 mb-4 flex items-center gap-2 border-b border-blue-100 dark:border-slate-800 pb-2">
                        <ShoppingBag className="w-5 h-5"/> {t('طلبات بانتظار الاعتماد','Pending Loan Requests')}
                      </h3>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        {pendingCart.map(req => (
                          <Card key={req.id} className="shadow-sm border border-slate-200 dark:border-slate-800 dark:bg-slate-900 hover:shadow-lg hover:-translate-y-1 hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-300 rounded-2xl overflow-hidden">
                            <div className="p-5 flex flex-col h-full">
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black text-lg border border-blue-100 dark:border-blue-800 shrink-0">
                                    {req.studentName.charAt(0)}
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base leading-tight">{req.studentName}</h4>
                                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">{req.studentId}</p>
                                  </div>
                                </div>
                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 border border-slate-200 dark:border-slate-700 shrink-0">
                                  <Clock className="w-3 h-3"/> {req.requestDate}
                                </span>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 mb-4 border border-slate-100 dark:border-slate-800 flex-1">
                                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5"/> {t('القطع المطلوبة:','Requested Items:')}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {req.items.slice(0,3).map((item, i) => {
                                    const inv = getInventoryDetails(item.componentName);
                                    return (
                                      <div key={i} className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 pr-2 pl-1 py-1 rounded-lg shadow-sm">
                                        <div className="w-6 h-6 bg-slate-50 dark:bg-slate-800 rounded flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                                          <img src={inv?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png'} className="max-w-full max-h-full object-contain" alt="" onError={e=>{e.currentTarget.src='https://cdn-icons-png.flaticon.com/512/679/679821.png'}}/>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[90px]">{lang==='ar'?(item.name_ar||item.componentName):(item.name_en||item.componentName)}</span>
                                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800">x{item.requestedQuantity}</span>
                                      </div>
                                    );
                                  })}
                                  {req.items.length > 3 && <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-400">+{req.items.length-3}</div>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 mb-4">
                                <Calendar className="w-4 h-4 text-orange-500"/>
                                {t('الإرجاع:','Return:')}
                                <span className="text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border border-orange-100 dark:border-orange-800 px-2 py-0.5 rounded-md">{req.expectedReturnDate}</span>
                              </div>
                              {req.note && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4 text-xs text-amber-800 dark:text-amber-300 font-medium">
                                  💬 {req.note}
                                </div>
                              )}
                              <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-auto">
                                <Button onClick={() => openCartDialog(req)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 text-sm"><Eye className="w-4 h-4 mr-1"/> {t('مراجعة وتحديد','Review & Decide')}</Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </section>
                  )}

                  {(pastCart.length > 0 || historyFilter !== 'all') && (
                    <section className="pt-6 border-t border-slate-200 dark:border-slate-800 mt-8">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                        <h3 className="font-black text-slate-700 dark:text-slate-300 text-lg flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500"/> {t('سجل العهد السابقة','Past Loans')}</h3>
                        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                          {(['all','approved','rejected'] as const).map(f => (
                            <button key={f} onClick={() => setHistoryFilter(f)}
                              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${historyFilter===f ? (f==='approved'?'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400':f==='rejected'?'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400':'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm') : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                              {f==='all'?t('الكل','All'):f==='approved'?t('المقبولة','Approved'):t('المرفوضة','Rejected')}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {pastCart.map(req => (
                            <div key={req.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">{req.studentName.charAt(0)}</div>
                                <div>
                                  <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{req.studentName} <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md ml-2 border border-blue-100 dark:border-blue-900">({req.items?.length} {t('قطع','items')})</span></p>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">{req.studentId} • {req.requestDate}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <StatusBadge status={req.status}/>
                                <button onClick={() => handlePrintCartRequest(req)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors" title={t('طباعة','Print')}>
                                  <Printer className="w-4 h-4"/>
                                </button>
                                {isSuperAdmin && (
                                  <button onClick={() => handleDeleteOldRequest('cart', req.id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                    <Trash2 className="w-4 h-4"/>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                          {pastCart.length === 0 && <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-8 font-bold">{t('لا توجد سجلات مطابقة','No matching records')}</p>}
                        </div>
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ══════════════ Dialog: تفاصيل طلب التسجيل ══════════════ */}
      <Dialog open={!!selectedRegReq} onOpenChange={() => setSelectedRegReq(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" dir={lang==='ar'?'rtl':'ltr'}>
          <DialogHeader className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <DialogTitle className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-blue-600"/> {t('تفاصيل طالب الانضمام','Applicant Details')}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto p-6 space-y-4 max-h-[70vh]">
            {selectedRegReq && (
              <>
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-3xl border-4 border-white dark:border-slate-800 shrink-0">{selectedRegReq.name.charAt(0)}</div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white">{selectedRegReq.name}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-0.5 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700">{translateRole(selectedRegReq.role)}</span>
                      <StatusBadge status={selectedRegReq.status}/>
                    </div>
                  </div>
                </div>
                {selectedRegReq.expectedAcademicId && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl p-4 text-center">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">{t('الرقم الأكاديمي المتوقع عند القبول','Expected Academic ID if Approved')}</p>
                    <p className="text-3xl font-black font-mono text-emerald-800 dark:text-emerald-300">{selectedRegReq.expectedAcademicId}</p>
                    {selectedRegReq.batch_name && <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">{t('دفعة','Batch')}: {selectedRegReq.batch_name}</p>}
                  </div>
                )}
                <div className="space-y-3">
                  <InfoRow icon={<Hash className="w-4 h-4"/>} label={t('الرقم المُدخل','Entered ID')} value={selectedRegReq.universityId}/>
                  {selectedRegReq.batch_name && <InfoRow icon={<BookOpen className="w-4 h-4"/>} label={t('الدفعة','Batch')} value={`${selectedRegReq.batch_name} (${selectedRegReq.batch_code})`}/>}
                  <InfoRow icon={<Phone className="w-4 h-4"/>} label={t('الجوال','Phone')} value={selectedRegReq.phone}/>
                  {selectedRegReq.phone && (
                    <a href={`https://wa.me/${formatPhoneForWA(selectedRegReq.phone)}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors border border-[#25D366]/20">
                      <MessageCircle className="w-4 h-4"/> {t('واتساب','WhatsApp')}
                    </a>
                  )}
                  <InfoRow icon={<Mail className="w-4 h-4"/>} label={t('البريد','Email')} value={selectedRegReq.email}/>
                  <InfoRow icon={<Clock className="w-4 h-4"/>} label={t('تاريخ الطلب','Request Date')} value={selectedRegReq.requestDate}/>
                </div>
              </>
            )}
          </div>
          {selectedRegReq && selectedRegReq.status === 'pending' && (
            <DialogFooter className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-2 gap-4">
              <Button onClick={() => handleRegAction(selectedRegReq.id,'rejected')} disabled={processingRegIds.has(selectedRegReq.id)}
                variant="outline" className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/30 h-12 font-bold text-base disabled:opacity-60">
                <XCircle className="w-5 h-5 mr-2"/> {t('رفض','Reject')}
              </Button>
              <Button onClick={() => handleRegAction(selectedRegReq.id,'approved')} disabled={processingRegIds.has(selectedRegReq.id)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-bold text-base disabled:opacity-60">
                <CheckCircle2 className="w-5 h-5 mr-2"/>
                {processingRegIds.has(selectedRegReq.id) ? t('جاري...','Processing...') : t('تفعيل الحساب','Approve')}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════ Dialog: مراجعة طلب العهدة (تحديد كل قطعة) ══════════════ */}
      <Dialog open={!!selectedCartReq} onOpenChange={() => setSelectedCartReq(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" dir={lang==='ar'?'rtl':'ltr'}>
          {selectedCartReq && (
            <>
              <DialogHeader className="p-5 border-b border-blue-700 dark:border-blue-900 bg-blue-600 dark:bg-blue-800">
                <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                  <ShoppingBag className="w-6 h-6 text-blue-200"/> {t('مراجعة وتحديد القطع','Review & Select Items')}
                </DialogTitle>
                <p className="text-blue-200 text-sm mt-1 font-medium">
                  {selectedCartReq.studentName} — {selectedCartReq.studentId}
                </p>
              </DialogHeader>

              <div className="overflow-y-auto max-h-[65vh] p-5 space-y-5 bg-slate-50 dark:bg-slate-950">

                {/* ── معلومات العهدة ── */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">{t('تاريخ الطلب','Request Date')}</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{selectedCartReq.requestDate}</p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-orange-500 uppercase mb-1">{t('تاريخ الإرجاع','Expected Return')}</p>
                    <p className="font-black text-orange-700 dark:text-orange-400 text-sm">{selectedCartReq.expectedReturnDate}</p>
                  </div>
                </div>
                {selectedCartReq.note && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                    💬 <strong>{t('ملاحظة الطالب:','Student note:')} </strong>{selectedCartReq.note}
                  </div>
                )}

                {/* ── تحديد الكل ── */}
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                    {t('القطع المقبولة:','Approved items:')} <span className={`font-black ${allRejected?'text-red-600 dark:text-red-400':allApproved?'text-emerald-600 dark:text-emerald-400':'text-blue-600 dark:text-blue-400'}`}>{approvedCount}/{totalItemCount}</span>
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      const all: Record<string,ItemDecision> = {};
                      selectedCartReq.items.forEach(i => { all[i.componentName] = { approved: true, approvedQty: i.requestedQuantity }; });
                      setItemDecisions(all);
                    }} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                      <CheckSquare className="w-3.5 h-3.5"/> {t('قبول الكل','Approve All')}
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button onClick={() => {
                      const none: Record<string,ItemDecision> = {};
                      selectedCartReq.items.forEach(i => { none[i.componentName] = { approved: false, approvedQty: 0 }; });
                      setItemDecisions(none);
                    }} className="text-xs font-bold text-red-500 dark:text-red-400 hover:underline flex items-center gap-1">
                      <Square className="w-3.5 h-3.5"/> {t('رفض الكل','Reject All')}
                    </button>
                  </div>
                </div>

                {/* ── قائمة القطع مع قرار كل واحدة ── */}
                <div className="space-y-3">
                  {selectedCartReq.items.map((item) => {
                    const invItem  = getInventoryDetails(item.componentName);
                    const imgUrl   = invItem?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png';
                    const stock    = invItem?.quantity ?? 0;
                    const location = invItem?.location;
                    const category = lang==='ar' ? (invItem?.category_ar||invItem?.category) : (invItem?.category_en||invItem?.category);
                    const dec      = itemDecisions[item.componentName] ?? { approved: true, approvedQty: item.requestedQuantity };
                    const noStock  = stock < item.requestedQuantity;

                    return (
                      <div key={item.componentName}
                        className={`bg-white dark:bg-slate-900 rounded-2xl border-2 p-4 transition-all ${
                          dec.approved
                            ? 'border-emerald-400 dark:border-emerald-700 shadow-sm'
                            : 'border-red-300 dark:border-red-800 opacity-70'
                        }`}>
                        <div className="flex items-start gap-3">
                          {/* صورة */}
                          <div className="w-14 h-14 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden p-1">
                            <img src={imgUrl} className="max-w-full max-h-full object-contain" alt="" onError={e=>{e.currentTarget.src='https://cdn-icons-png.flaticon.com/512/679/679821.png'}}/>
                          </div>

                          {/* معلومات */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                              {lang==='ar'?(item.name_ar||item.componentName):(item.name_en||item.componentName)}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {category && <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1"><Tag className="w-3 h-3"/>{category}</span>}
                              <LocationBadge location={location} small/>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              <span className="text-slate-500 dark:text-slate-400">{t('مطلوب:','Req:')} <strong className="text-slate-800 dark:text-slate-200">{item.requestedQuantity}</strong></span>
                              <span className={noStock ? 'text-red-600 dark:text-red-400 font-bold' : 'text-emerald-600 dark:text-emerald-400'}>{t('متاح:','Stock:')} <strong>{stock}</strong></span>
                            </div>
                            {noStock && (
                              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg border border-red-200 dark:border-red-800">
                                <AlertTriangle className="w-3 h-3 shrink-0"/> {t('الكمية غير كافية','Insufficient stock')}
                              </div>
                            )}
                          </div>

                          {/* زر القبول/الرفض + الكمية */}
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <button
                              onClick={() => setItemDecisions(prev => ({
                                ...prev,
                                [item.componentName]: { approved: !dec.approved, approvedQty: !dec.approved ? item.requestedQuantity : 0 }
                              }))}
                              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all font-black text-sm ${
                                dec.approved
                                  ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600'
                                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-emerald-400'
                              }`}
                            >
                              {dec.approved ? <CheckCircle2 className="w-4 h-4"/> : <XCircle className="w-4 h-4"/>}
                            </button>

                            {dec.approved && (
                              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1" dir="ltr">
                                <button onClick={() => setItemDecisions(prev => ({
                                  ...prev,
                                  [item.componentName]: { approved: true, approvedQty: Math.max(1, dec.approvedQty - 1) }
                                }))} className="w-6 h-6 flex items-center justify-center rounded text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-lg leading-none">−</button>
                                <span className="w-6 text-center text-sm font-black text-blue-600 dark:text-blue-400">{dec.approvedQty}</span>
                                <button onClick={() => setItemDecisions(prev => ({
                                  ...prev,
                                  [item.componentName]: { approved: true, approvedQty: Math.min(item.requestedQuantity, stock, dec.approvedQty + 1) }
                                }))} disabled={dec.approvedQty >= Math.min(item.requestedQuantity, stock)} className="w-6 h-6 flex items-center justify-center rounded text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-lg leading-none disabled:opacity-40">+</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── تعليق المشرف ── */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                    💬 {t('تعليق / ملاحظة توصل للطالب (اختياري)','Comment to student (optional)')}
                  </Label>
                  <Textarea
                    value={adminComment}
                    onChange={e => setAdminComment(e.target.value)}
                    placeholder={t('أكتب أي ملاحظة للطالب تُطبع في سند العهدة...','Write any note to the student, printed on the receipt...')}
                    className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-none h-20 rounded-lg"
                  />
                </div>
              </div>

              <DialogFooter className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-3">
                <Button onClick={() => handleCartDecision('rejected')} disabled={submitting}
                  variant="outline" className="flex-1 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/30 h-12 font-bold text-base disabled:opacity-60">
                  <XCircle className="w-5 h-5 mr-2"/> {t('رفض الكل','Reject All')}
                </Button>
                <Button onClick={() => handleCartDecision('approved')} disabled={submitting || allRejected}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-12 font-bold text-base disabled:opacity-60 gap-2">
                  <FileDown className="w-5 h-5"/>
                  {submitting ? t('جاري...','Processing...') : allApproved ? t('اعتماد كامل + PDF','Full Approve + PDF') : t('اعتماد جزئي + PDF','Partial Approve + PDF')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AdminRequests;
