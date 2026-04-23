import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { apiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Scanner } from '@yudiel/react-qr-scanner';
import {
  Package, Plus, Edit3, Trash2, QrCode, Send, CheckCircle2,
  AlertTriangle, X, Search, RefreshCw, Box as BoxIcon, Layers,
  Calendar, User as UserIcon, ClipboardCheck, Loader2, Eye,
  Users, Hash, MapPin, Tag, ScanLine, Printer, GraduationCap,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════
interface BoxItem {
  id?: number;
  item_name: string;
  itemName?: string;
  quantity_required: number;
  quantity?: number;
  notes?: string;
  available_in_stock?: number;
  imageUrl?: string;
  item_category?: string;
  item_location?: string;
}

interface BoxInstance {
  id: number;
  qr_code: string;
  label: string;
  status: 'available' | 'loaned' | 'maintenance' | 'retired';
  notes?: string;
  active_loan_id?: number;
  active_student_id?: string;
  active_student_name?: string;
  active_return_date?: string;
  created_at?: string;
  updated_at?: string;
}

interface Box {
  id: number;
  name: string;
  name_en: string;
  description: string;
  image_url: string;
  category: string;
  code_prefix: string;
  is_hidden: number;
  items_count: number;
  total_qty: number;
  total_instances: number;
  available_instances: number;
  loaned_instances: number;
  maintenance_instances: number;
  items?: BoxItem[];
  instances?: BoxInstance[];
  created_at: string;
}

interface BoxLoan {
  id: number;
  box_id: number;
  instance_id: number;
  university_id: string;
  student_name: string;
  checkout_date: string;
  expected_return_date: string;
  returned_at: string;
  status: 'active' | 'returned' | 'overdue' | 'partial_return';
  box_name: string;
  box_image: string;
  code_prefix: string;
  instance_qr: string;
  instance_label: string;
  items_count: number;
}

interface InventoryItem {
  id?: number;
  name: string;
  name_en?: string;
  quantity: number;
  category?: string;
  location?: string;
  imageUrl?: string;
}

interface Student {
  universityId: string;
  name: string;
}

const STATUS_CONFIG: Record<string, { ar: string; en: string; color: string; bg: string }> = {
  available:      { ar: 'متاح',           en: 'Available',  color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
  loaned:         { ar: 'مُستعار',        en: 'On Loan',    color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  maintenance:    { ar: 'صيانة',          en: 'Maintenance',color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  retired:        { ar: 'متقاعد',         en: 'Retired',    color: 'text-slate-500',   bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
  active:         { ar: 'نشطة',           en: 'Active',     color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  returned:       { ar: 'مُرجعة',         en: 'Returned',   color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
  overdue:        { ar: 'متأخرة',         en: 'Overdue',    color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  partial_return: { ar: 'إرجاع ناقص',     en: 'Partial',    color: 'text-orange-600',  bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
};

// ════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════
export default function AdminBoxes() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();

  const [tab, setTab] = useState<'boxes' | 'loans'>('boxes');
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loans, setLoans] = useState<BoxLoan[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Box | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loanFor, setLoanFor] = useState<Box | null>(null);
  const [bulkFor, setBulkFor] = useState<Box | null>(null);
  const [batchFor, setBatchFor] = useState<Box | null>(null);
  const [manageFor, setManageFor] = useState<Box | null>(null);
  const [returnFor, setReturnFor] = useState<BoxLoan | null>(null);
  const [scanOpen, setScanOpen] = useState(false);

  const adminHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    'admin-id': encodeURIComponent(user?.id || ''),
    'admin-name': encodeURIComponent(user?.name || ''),
  }), [user]);

  // ─── Fetchers ───────────────────────────────────────────────────
  const fetchBoxes = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/boxes?admin=1'));
      const data = await res.json();
      if (data.status === 'success') setBoxes(data.data || []);
    } catch {
      toast({ title: t('فشل تحميل البوكسات', 'Failed to load boxes'), variant: 'destructive' });
    }
  }, [t, toast]);

  const fetchLoans = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/box-loans'));
      const data = await res.json();
      if (data.status === 'success') setLoans(data.data || []);
    } catch {
      console.error('loans fetch failed');
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/items?admin=1'));
      const data = await res.json();
      if (data.status === 'success') setInventory(data.data || []);
    } catch { /* ignore */ }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/users'));
      const data = await res.json();
      const users = data.data || data || [];
      setStudents(
        users.filter((u: any) =>
          (u.role || '').toLowerCase().includes('طالب') ||
          (u.role || '').toLowerCase() === 'student'
        ).map((u: any) => ({ universityId: u.universityId, name: u.name }))
      );
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchBoxes(), fetchLoans(), fetchInventory(), fetchStudents()])
      .finally(() => setLoading(false));
  }, [fetchBoxes, fetchLoans, fetchInventory, fetchStudents]);

  // ─── Actions ────────────────────────────────────────────────────
  const handleDelete = async (box: Box) => {
    if (!confirm(t(`حذف البوكس "${box.name}" بكل نسخه؟`, `Delete box "${box.name}" and all its instances?`))) return;
    try {
      const res = await fetch(apiUrl(`/api/boxes/${box.id}`), { method: 'DELETE', headers: adminHeaders });
      const data = await res.json();
      if (res.ok) { toast({ title: t('تم الحذف', 'Deleted') }); fetchBoxes(); }
      else toast({ title: data.message || t('خطأ', 'Error'), variant: 'destructive' });
    } catch {
      toast({ title: t('فشل الاتصال', 'Network error'), variant: 'destructive' });
    }
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BoxIcon className="w-7 h-7 text-blue-600" />
            {t('البوكسات (العهد الجماعية)', 'Boxes (Group Kits)')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('قوالب بوكسات مع نسخ متعددة لكل قالب — لكل نسخة QR منفصل', 'Box templates with multiple instances — each instance has its own QR')}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { fetchBoxes(); fetchLoans(); }} className="gap-2">
            <RefreshCw className="w-4 h-4" /> {t('تحديث', 'Refresh')}
          </Button>
          <Button variant="outline" onClick={() => setScanOpen(true)} className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/20">
            <ScanLine className="w-4 h-4" /> {t('مسح QR', 'Scan QR')}
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-cta">
            <Plus className="w-4 h-4" /> {t('بوكس جديد', 'New Box')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setTab('boxes')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-colors ${
            tab === 'boxes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4 inline mr-1.5" />
          {t('قوالب البوكسات', 'Box Templates')} ({boxes.length})
        </button>
        <button
          onClick={() => setTab('loans')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-colors ${
            tab === 'loans' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 inline mr-1.5" />
          {t('استعارات نشطة', 'Active Loans')} ({loans.filter(l => l.status === 'active' || l.status === 'overdue').length})
          {loans.some(l => l.status === 'overdue') && (
            <span className="ms-1.5 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {loans.filter(l => l.status === 'overdue').length} {t('متأخرة', 'overdue')}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /></div>
      ) : tab === 'boxes' ? (
        <BoxesGrid
          boxes={boxes}
          onEdit={(b: Box) => { setEditing(b); setFormOpen(true); }}
          onDelete={handleDelete}
          onLoan={(b: Box) => setLoanFor(b)}
          onBulk={(b: Box) => setBulkFor(b)}
          onBatch={(b: Box) => setBatchFor(b)}
          onManage={(b: Box) => setManageFor(b)}
          t={t}
        />
      ) : (
        <LoansList
          loans={loans}
          onReturn={(l: BoxLoan) => setReturnFor(l)}
          onRefresh={fetchLoans}
          adminHeaders={adminHeaders}
          t={t}
          toast={toast}
        />
      )}

      {/* ─── Dialogs ──────────────────────────────────────────────── */}
      {formOpen && (
        <BoxFormDialog
          box={editing}
          inventory={inventory}
          adminHeaders={adminHeaders}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={() => { setFormOpen(false); setEditing(null); fetchBoxes(); }}
          t={t} lang={lang} toast={toast}
        />
      )}

      {loanFor && (
        <LoanBoxDialog
          box={loanFor}
          students={students}
          adminHeaders={adminHeaders}
          onClose={() => setLoanFor(null)}
          onSuccess={() => { setLoanFor(null); fetchBoxes(); fetchLoans(); }}
          t={t} lang={lang} toast={toast}
        />
      )}

      {bulkFor && (
        <BulkDistributeDialog
          box={bulkFor}
          students={students}
          adminHeaders={adminHeaders}
          onClose={() => setBulkFor(null)}
          onSuccess={() => { setBulkFor(null); fetchBoxes(); fetchLoans(); }}
          t={t} lang={lang} toast={toast}
        />
      )}

      {manageFor && (
        <ManageInstancesDialog
          box={manageFor}
          adminHeaders={adminHeaders}
          onClose={() => setManageFor(null)}
          onChanged={() => { fetchBoxes(); }}
          t={t} lang={lang} toast={toast}
        />
      )}

      {returnFor && (
        <ReturnChecklistDialog
          loan={returnFor}
          adminHeaders={adminHeaders}
          onClose={() => setReturnFor(null)}
          onSuccess={() => { setReturnFor(null); fetchBoxes(); fetchLoans(); }}
          t={t} lang={lang} toast={toast}
        />
      )}

      {batchFor && (
        <BatchDistributeDialog
          box={batchFor}
          adminHeaders={adminHeaders}
          onClose={() => setBatchFor(null)}
          onSuccess={() => { setBatchFor(null); fetchBoxes(); fetchLoans(); }}
          t={t} lang={lang} toast={toast}
        />
      )}

      {scanOpen && (
        <QrScannerDialog
          onClose={() => setScanOpen(false)}
          t={t} lang={lang}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Boxes Grid (templates with stats)
// ════════════════════════════════════════════════════════════════════
function BoxesGrid({ boxes, onEdit, onDelete, onLoan, onBulk, onBatch, onManage, t }: any) {
  if (!boxes.length) {
    return (
      <div className="text-center py-16 card-3xl border-dashed">
        <BoxIcon className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-lg font-black text-slate-500">{t('لا يوجد قوالب بوكسات بعد', 'No box templates yet')}</p>
        <p className="text-sm text-slate-400 mt-1">{t('أنشئ قالباً جديداً مع عدد النسخ المطلوبة', 'Create a new template with the number of instances you need')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {boxes.map((box: Box) => {
        const total = box.total_instances || 0;
        const avail = box.available_instances || 0;
        const loaned = box.loaned_instances || 0;
        const maint = box.maintenance_instances || 0;
        const noInstances = total === 0;

        return (
          <div key={box.id} className="card-3xl overflow-hidden flex flex-col">
            <div className="relative image-well bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
              {box.image_url ? (
                <img src={box.image_url} alt={box.name} className="w-full h-full object-contain p-4" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BoxIcon size={40} className="text-slate-300" />
                </div>
              )}
              <div className="absolute top-3 left-3">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700">
                  <Hash size={11} /> {box.code_prefix || 'BX'}
                </span>
              </div>
              <div className="absolute top-3 right-3">
                <button
                  onClick={() => onManage(box)}
                  className="px-2.5 py-1 bg-white/90 dark:bg-slate-900/90 rounded-lg hover:bg-white shadow text-xs font-bold flex items-center gap-1"
                  title={t('إدارة النسخ', 'Manage instances')}
                >
                  <Layers size={13} className="text-blue-600" />
                  <span className="text-slate-700 dark:text-slate-200">{total}</span>
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3 flex-1 flex flex-col">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white">{box.name}</h3>
                {box.name_en && <p className="text-xs text-slate-400 font-mono">{box.name_en}</p>}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="rounded-lg py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-base font-black text-emerald-600">{avail}</div>
                  <div className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400">{t('متاح', 'Available')}</div>
                </div>
                <div className="rounded-lg py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="text-base font-black text-blue-600">{loaned}</div>
                  <div className="text-[9px] font-bold text-blue-700 dark:text-blue-400">{t('مُستعار', 'Loaned')}</div>
                </div>
                <div className="rounded-lg py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="text-base font-black text-amber-600">{maint}</div>
                  <div className="text-[9px] font-bold text-amber-700 dark:text-amber-400">{t('صيانة', 'Maint.')}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg font-bold text-slate-600 dark:text-slate-300">
                  {box.category}
                </span>
                <span className="font-mono text-slate-500">
                  {box.items_count} {t('قطعة', 'items')} · {box.total_qty || 0} {t('وحدة', 'units')}
                </span>
              </div>

              {box.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{box.description}</p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200 dark:border-slate-700 mt-auto">
                <Button
                  size="sm"
                  onClick={() => onLoan(box)}
                  disabled={noInstances || avail === 0}
                  className="text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                  title={noInstances ? t('لا توجد نسخ', 'No instances') : avail === 0 ? t('لا متاح', 'None available') : ''}
                >
                  <Send size={12} /> {t('صرف نسخة', 'Loan one')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => onBulk(box)}
                  disabled={noInstances || avail === 0}
                  className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Users size={12} /> {t('توزيع جماعي', 'Bulk')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => onBatch(box)}
                  disabled={noInstances || avail === 0}
                  className="text-xs gap-1 bg-violet-600 hover:bg-violet-700 text-white col-span-2"
                >
                  <GraduationCap size={12} /> {t('توزيع لدفعة كاملة', 'Distribute to batch')}
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => onEdit(box)}
                  className="text-xs gap-1 dark:border-slate-700"
                >
                  <Edit3 size={12} /> {t('تعديل', 'Edit')}
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => onDelete(box)}
                  className="text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={12} /> {t('حذف', 'Delete')}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Loans List
// ════════════════════════════════════════════════════════════════════
function LoansList({ loans, onReturn, onRefresh, adminHeaders, t, toast }: any) {
  const [filter, setFilter] = useState<'active' | 'all' | 'returned'>('active');
  const [search, setSearch] = useState('');

  const filtered = loans.filter((l: BoxLoan) => {
    const matchStatus =
      filter === 'all' ? true :
      filter === 'active' ? (l.status === 'active' || l.status === 'overdue') :
      (l.status === 'returned' || l.status === 'partial_return');

    if (!matchStatus) return false;
    if (!search.trim()) return true;

    const q = search.trim().toLowerCase();
    return (
      (l.student_name || '').toLowerCase().includes(q) ||
      (l.university_id || '').toLowerCase().includes(q) ||
      (l.box_name || '').toLowerCase().includes(q) ||
      (l.instance_label || '').toLowerCase().includes(q) ||
      (l.instance_qr || '').toLowerCase().includes(q) ||
      String(l.id).includes(q)
    );
  });

  const handleCancel = async (loan: BoxLoan) => {
    if (!confirm(t('إلغاء استعارة هذا البوكس؟', 'Cancel this box loan?'))) return;
    try {
      const res = await fetch(apiUrl(`/api/box-loans/${loan.id}`), { method: 'DELETE', headers: adminHeaders });
      const data = await res.json();
      if (res.ok) { toast({ title: t('تم الإلغاء', 'Cancelled') }); onRefresh(); }
      else toast({ title: data.message || t('خطأ', 'Error'), variant: 'destructive' });
    } catch {
      toast({ title: t('فشل الاتصال', 'Network error'), variant: 'destructive' });
    }
  };

  const handlePrint = () => {
    const printContent = filtered.map(l =>
      `${l.id}\t${l.box_name}\t${l.instance_label||'—'}\t${l.student_name||l.university_id}\t${l.expected_return_date}\t${t(STATUS_CONFIG[l.status]?.ar, STATUS_CONFIG[l.status]?.en)}`
    ).join('\n');
    const header = `${t('م','#')}\t${t('البوكس','Box')}\t${t('النسخة','Instance')}\t${t('الطالب','Student')}\t${t('تاريخ الإرجاع','Due')}\t${t('الحالة','Status')}`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html dir="rtl"><head><title>${t('تقرير الاستعارات','Loans Report')}</title>
      <style>body{font-family:Arial;direction:rtl;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px 12px;text-align:right;font-size:13px}th{background:#f0f4ff;font-weight:bold}tr:nth-child(even){background:#f9f9f9}h2{margin-bottom:16px}</style>
      </head><body><h2>${t('تقرير استعارات البوكسات','Box Loans Report')} — ${new Date().toLocaleDateString('ar-SA')}</h2><table><thead><tr>${
      header.split('\t').map(h => `<th>${h}</th>`).join('')
    }</tr></thead><tbody>${
      filtered.map(l =>
        `<tr><td>${l.id}</td><td>${l.box_name}</td><td style="font-family:monospace">${l.instance_label||'—'}</td><td>${l.student_name||l.university_id}</td><td>${l.expected_return_date}</td><td>${t(STATUS_CONFIG[l.status]?.ar, STATUS_CONFIG[l.status]?.en)}</td></tr>`
      ).join('')
    }</tbody></table></body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 start-3" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('ابحث باسم الطالب، رقمه، اسم البوكس، أو رقم النسخة...', 'Search by student name, ID, box name, or instance label...')}
          className="ps-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter + print */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { k: 'active', ar: 'نشطة', en: 'Active' },
          { k: 'returned', ar: 'مُرجعة', en: 'Returned' },
          { k: 'all', ar: 'الكل', en: 'All' },
        ].map(f => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k as any)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              filter === f.k ? 'bg-blue-600 text-white shadow-cta' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t(f.ar, f.en)}
          </button>
        ))}
        {search && (
          <span className="text-xs text-slate-500 font-mono">
            {filtered.length} {t('نتيجة', 'result(s)')}
          </span>
        )}
        <button
          onClick={handlePrint}
          className="ms-auto flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400 transition-all"
        >
          <Printer size={13} /> {t('طباعة', 'Print')}
        </button>
      </div>

      {!filtered.length ? (
        <div className="text-center py-16 card-3xl border-dashed">
          <ClipboardCheck className="w-16 h-16 mx-auto text-slate-300 mb-3" />
          <p className="text-lg font-black text-slate-500">{t('لا توجد استعارات', 'No loans')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((loan: BoxLoan) => {
            const sc = STATUS_CONFIG[loan.status];
            const isOverdue = loan.status === 'active' &&
              new Date(loan.expected_return_date) < new Date();
            return (
              <div key={loan.id} className="card-3xl overflow-hidden">
                <div className={`px-4 py-2.5 ${sc.bg} border-b flex items-center justify-between`}>
                  <span className={`text-xs font-black ${sc.color}`}>
                    {isOverdue ? t('متأخرة', 'Overdue') : t(sc.ar, sc.en)}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">#{loan.id}</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {loan.box_image ? (
                      <img src={loan.box_image} alt={loan.box_name} className="w-16 h-16 rounded-lg object-contain bg-slate-50 dark:bg-slate-800 p-1" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <BoxIcon size={28} className="text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-slate-900 dark:text-white truncate">{loan.box_name}</h3>
                      <p className="text-xs font-bold text-blue-600 font-mono">
                        🏷 {loan.instance_label || loan.instance_qr || '—'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{loan.items_count} {t('قطعة', 'items')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <UserIcon size={12} />
                      <span className="truncate">{loan.student_name || loan.university_id}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <Calendar size={12} />
                      <span>{loan.expected_return_date}</span>
                    </div>
                  </div>
                  {(loan.status === 'active' || loan.status === 'overdue') && (
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <Button onClick={() => onReturn(loan)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs">
                        <ClipboardCheck size={12} /> {t('إرجاع', 'Return')}
                      </Button>
                      <Button onClick={() => handleCancel(loan)} variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 text-xs gap-1">
                        <X size={12} /> {t('إلغاء', 'Cancel')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Box Form Dialog (template + initial instance count)
// ════════════════════════════════════════════════════════════════════
function BoxFormDialog({ box, inventory, adminHeaders, onClose, onSaved, t, lang, toast }: any) {
  const [name, setName] = useState(box?.name || '');
  const [nameEn, setNameEn] = useState(box?.name_en || '');
  const [description, setDescription] = useState(box?.description || '');
  const [imageUrl, setImageUrl] = useState(box?.image_url || '');
  const [category, setCategory] = useState(box?.category || 'عام');
  const [codePrefix, setCodePrefix] = useState(box?.code_prefix || '');
  const [initialCount, setInitialCount] = useState<number>(box ? 0 : 1);
  const [items, setItems] = useState<{ itemName: string; quantity: number; notes?: string }[]>(
    (box?.items || []).map((i: BoxItem) => ({
      itemName: i.item_name,
      quantity: i.quantity_required,
      notes: i.notes || '',
    }))
  );
  const [saving, setSaving] = useState(false);
  const [itemSearch, setItemSearch] = useState('');

  const addItem = (itemName: string) => {
    if (items.find(i => i.itemName === itemName)) return;
    setItems([...items, { itemName, quantity: 1 }]);
    setItemSearch('');
  };
  const updateItem = (idx: number, patch: Partial<{ quantity: number; notes: string }>) =>
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: t('اسم البوكس مطلوب', 'Box name required'), variant: 'destructive' });
      return;
    }
    if (!items.length) {
      toast({ title: t('أضف قطعة واحدة على الأقل', 'Add at least one item'), variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const url = box ? apiUrl(`/api/boxes/${box.id}`) : apiUrl('/api/boxes');
      const method = box ? 'PUT' : 'POST';
      const body: any = {
        name, nameEn, description, imageUrl, category,
        codePrefix: codePrefix || undefined,
        items,
      };
      if (!box) body.initialInstanceCount = Math.max(0, initialCount || 0);

      const res = await fetch(url, { method, headers: adminHeaders, body: JSON.stringify(body) });
      let data: any = {};
      try { data = await res.json(); } catch { /* non-JSON */ }
      if (res.ok) {
        toast({
          title: t(box ? 'تم التحديث' : 'تم إنشاء القالب ✅', box ? 'Updated' : 'Template created ✅'),
          description: !box && initialCount > 0
            ? t(`تم إنشاء ${initialCount} نسخة`, `Created ${initialCount} instance(s)`)
            : undefined,
        });
        onSaved();
      } else {
        toast({
          title: t('فشل الحفظ', 'Save failed'),
          description: data.message || `HTTP ${res.status}`,
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({
        title: t('فشل الاتصال', 'Network error'),
        description: e?.message || t('تأكد من تشغيل الخادم', 'Make sure the server is running'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredInventory = inventory.filter((i: InventoryItem) =>
    !itemSearch || i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    (i.category || '').toLowerCase().includes(itemSearch.toLowerCase())
  );

  const isInBox = (n: string) => items.some(i => i.itemName === n);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <BoxIcon className="w-6 h-6" />
            {box ? t('تعديل قالب البوكس', 'Edit Box Template') : t('قالب بوكس جديد', 'New Box Template')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="font-bold mb-1.5 block">{t('اسم القالب *', 'Template Name *')}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('مثال: حقيبة أردوينو', 'e.g. Arduino Kit')} />
            </div>
            <div>
              <Label className="font-bold mb-1.5 block">{t('الاسم بالإنجليزية', 'English Name')}</Label>
              <Input value={nameEn} onChange={e => setNameEn(e.target.value)} dir="ltr" />
            </div>
            <div>
              <Label className="font-bold mb-1.5 block">{t('التصنيف', 'Category')}</Label>
              <Input value={category} onChange={e => setCategory(e.target.value)} />
            </div>
            <div>
              <Label className="font-bold mb-1.5 block flex items-center gap-1">
                <Hash size={12} /> {t('رمز النسخ (للـ QR)', 'Instance Prefix (for QR)')}
              </Label>
              <Input
                value={codePrefix}
                onChange={e => setCodePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder={t('مثال: ARD → ARD-001', 'e.g. ARD → ARD-001')}
                dir="ltr"
                maxLength={20}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="font-bold mb-1.5 block">{t('رابط صورة', 'Image URL')}</Label>
              <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} dir="ltr" />
            </div>
          </div>

          <div>
            <Label className="font-bold mb-1.5 block">{t('الوصف', 'Description')}</Label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 dark:text-white resize-none"
            />
          </div>

          {!box && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
              <Label className="font-black text-blue-700 dark:text-blue-300 mb-1.5 block flex items-center gap-1.5">
                <Layers size={14} /> {t('عدد النسخ الأولي', 'Initial number of instances')}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={initialCount}
                  onChange={e => setInitialCount(Math.max(0, Math.min(200, parseInt(e.target.value) || 0)))}
                  className="w-24 text-center font-black text-base"
                />
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {t('سيُولَّد لكل نسخة QR منفصل (مثلاً ARD-001 ، ARD-002…)', 'Each instance gets its own QR (e.g. ARD-001, ARD-002…)')}
                </p>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {t('يمكنك إضافة المزيد لاحقاً من زر "إدارة النسخ"', 'You can add more later via "Manage Instances"')}
              </p>
            </div>
          )}

          {/* Items selector — split view */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-bold block">
                {t('محتويات البوكس *', 'Box Contents *')}
                {items.length > 0 && (
                  <span className="ms-2 text-xs font-mono bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                    {items.length} {t('قطعة', 'items')}
                  </span>
                )}
              </Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Catalog */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 flex flex-col" style={{ maxHeight: '420px' }}>
                <div className="p-2 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
                  <div className="relative">
                    <Search className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 left-2.5 rtl:left-auto rtl:right-2.5" />
                    <Input
                      value={itemSearch}
                      onChange={e => setItemSearch(e.target.value)}
                      placeholder={t('ابحث في المخزون...', 'Search inventory...')}
                      className="pl-8 rtl:pl-3 rtl:pr-8 h-8 text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 px-1">
                    {t('انقر على القطعة لإضافتها', 'Click an item to add it')} · {filteredInventory.length} {t('قطعة', 'items')}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                  {filteredInventory.length === 0 ? (
                    <div className="text-center text-xs text-slate-400 py-8">{t('لا قطع مطابقة', 'No matching items')}</div>
                  ) : filteredInventory.map((it: InventoryItem) => {
                    const added = isInBox(it.name);
                    const outOfStock = (it.quantity ?? 0) <= 0;
                    return (
                      <button
                        key={it.name}
                        onClick={() => !added && addItem(it.name)}
                        disabled={added}
                        className={`w-full text-right rtl:text-right ltr:text-left p-2 rounded-lg text-xs flex items-center gap-2 transition-all ${
                          added
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 cursor-default'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm'
                        }`}
                      >
                        {it.imageUrl ? (
                          <img src={it.imageUrl} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                        ) : added
                          ? <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                          : <Plus size={14} className="text-blue-600 flex-shrink-0" />}
                        <span className="flex-1 min-w-0">
                          <span className={`block font-bold truncate ${added ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-white'}`}>
                            {it.name}
                          </span>
                          {(it.category || it.location) && (
                            <span className="block text-[9px] text-slate-400 truncate">
                              {it.category && <><Tag size={8} className="inline" /> {it.category} </>}
                              {it.location && <><MapPin size={8} className="inline ml-1" /> {it.location}</>}
                            </span>
                          )}
                        </span>
                        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                          outOfStock ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {it.quantity ?? 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col" style={{ maxHeight: '420px' }}>
                <div className="p-2 border-b border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20 rounded-t-xl">
                  <p className="text-xs font-black text-blue-700 dark:text-blue-300 px-1">
                    📦 {t('قطع البوكس', 'Box Contents')}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 px-1">{t('عدّل الكميات أو احذف', 'Adjust quantities or remove')}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
                  {items.length === 0 ? (
                    <div className="text-center py-8 px-3">
                      <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                      <p className="text-xs font-bold text-slate-400">{t('لم تُضف قطع بعد', 'No items added')}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{t('اختر من القائمة على اليسار', 'Pick from the list on the left')}</p>
                    </div>
                  ) : items.map((it, idx) => {
                    const inv = inventory.find((i: InventoryItem) => i.name === it.itemName);
                    const overStock = inv && it.quantity > inv.quantity;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-1.5 p-2 rounded-lg ${
                          overStock
                            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                            : 'bg-slate-50 dark:bg-slate-800'
                        }`}
                      >
                        {inv?.imageUrl
                          ? <img src={inv.imageUrl} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                          : <Package size={12} className="text-blue-600 flex-shrink-0" />}
                        <span className="flex-1 text-xs font-bold text-slate-800 dark:text-white truncate" title={it.itemName}>{it.itemName}</span>
                        <Input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={e => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-14 h-7 text-center text-xs px-1"
                        />
                        <span className="text-[10px] text-slate-400 font-mono">/{inv?.quantity ?? '?'}</span>
                        <button
                          onClick={() => removeItem(idx)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 flex-shrink-0"
                          title={t('إزالة', 'Remove')}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>{t('إلغاء', 'Cancel')}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {t('حفظ', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════
// Manage Instances Dialog
// ════════════════════════════════════════════════════════════════════
function ManageInstancesDialog({ box, adminHeaders, onClose, onChanged, t, lang, toast }: any) {
  const [instances, setInstances] = useState<BoxInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [addCount, setAddCount] = useState<number>(1);
  const [adding, setAdding] = useState(false);
  const [showQrFor, setShowQrFor] = useState<BoxInstance | null>(null);

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/boxes/${box.id}/instances`));
      const data = await res.json();
      if (data.status === 'success') setInstances(data.data || []);
    } finally { setLoading(false); }
  }, [box.id]);

  useEffect(() => { fetchInstances(); }, [fetchInstances]);

  const handleAdd = async () => {
    if (addCount < 1) return;
    setAdding(true);
    try {
      const res = await fetch(apiUrl(`/api/boxes/${box.id}/instances`), {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ count: addCount }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: t(`تمت إضافة ${addCount} نسخة ✅`, `Added ${addCount} instance(s) ✅`) });
        setAddCount(1);
        fetchInstances(); onChanged();
      } else {
        toast({ title: data.message || t('خطأ', 'Error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('فشل الاتصال', 'Network error'), variant: 'destructive' });
    } finally { setAdding(false); }
  };

  const handleDelete = async (inst: BoxInstance) => {
    if (!confirm(t(`حذف النسخة ${inst.label}؟`, `Delete instance ${inst.label}?`))) return;
    try {
      const res = await fetch(apiUrl(`/api/box-instances/${inst.id}`), {
        method: 'DELETE', headers: adminHeaders,
      });
      const data = await res.json();
      if (res.ok) { toast({ title: t('تم الحذف', 'Deleted') }); fetchInstances(); onChanged(); }
      else toast({ title: data.message || t('خطأ', 'Error'), variant: 'destructive' });
    } catch {
      toast({ title: t('فشل الاتصال', 'Network error'), variant: 'destructive' });
    }
  };

  const handleSetMaintenance = async (inst: BoxInstance, status: 'available' | 'maintenance' | 'retired') => {
    try {
      const res = await fetch(apiUrl(`/api/box-instances/${inst.id}`), {
        method: 'PUT', headers: adminHeaders,
        body: JSON.stringify({ status }),
      });
      if (res.ok) { fetchInstances(); onChanged(); }
    } catch { /* ignore */ }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <Layers className="w-6 h-6" />
            {t(`نسخ "${box.name}"`, `Instances of "${box.name}"`)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Add new instances */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex items-center gap-3">
            <div className="flex-1">
              <Label className="font-black text-blue-700 dark:text-blue-300 mb-1 block">
                {t('إضافة نسخ جديدة', 'Add new instances')}
              </Label>
              <p className="text-[10px] text-slate-500">
                {t(`سيُولَّد لكل نسخة QR منفصل بالبادئة "${box.code_prefix || 'BX'}"`,
                   `Each gets its own QR with prefix "${box.code_prefix || 'BX'}"`)}
              </p>
            </div>
            <Input
              type="number"
              min={1}
              max={200}
              value={addCount}
              onChange={e => setAddCount(Math.max(1, Math.min(200, parseInt(e.target.value) || 1)))}
              className="w-20 text-center font-black"
            />
            <Button onClick={handleAdd} disabled={adding} className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t('إضافة', 'Add')}
            </Button>
          </div>

          {/* Instances list */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
          ) : instances.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              <Layers className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="font-bold text-slate-500">{t('لا توجد نسخ بعد', 'No instances yet')}</p>
              <p className="text-xs text-slate-400 mt-1">{t('أضف نسخة باستخدام الأعلى', 'Add instances using the form above')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {instances.map(inst => {
                const sc = STATUS_CONFIG[inst.status];
                return (
                  <div key={inst.id} className={`border rounded-xl p-3 ${sc.bg}`}>
                    <div className="flex items-start gap-3">
                      <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
                        <Hash size={20} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base text-slate-900 dark:text-white">{inst.label}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.color}`}>
                            {t(sc.ar, sc.en)}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">{inst.qr_code}</p>
                        {inst.active_student_name && (
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                            <UserIcon size={10} /> {inst.active_student_name}
                            {inst.active_return_date && <> · 📅 {inst.active_return_date}</>}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => setShowQrFor(inst)}
                        className="flex-1 text-[10px] font-bold py-1 rounded bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1"
                      >
                        <QrCode size={11} /> {t('QR', 'QR')}
                      </button>
                      {inst.status === 'maintenance' && (
                        <button
                          onClick={() => handleSetMaintenance(inst, 'available')}
                          className="flex-1 text-[10px] font-bold py-1 rounded bg-white dark:bg-slate-900 hover:bg-emerald-50 text-emerald-600 border border-slate-200 dark:border-slate-700"
                        >
                          {t('تفعيل', 'Re-enable')}
                        </button>
                      )}
                      {inst.status === 'available' && (
                        <button
                          onClick={() => handleSetMaintenance(inst, 'maintenance')}
                          className="flex-1 text-[10px] font-bold py-1 rounded bg-white dark:bg-slate-900 hover:bg-amber-50 text-amber-600 border border-slate-200 dark:border-slate-700"
                        >
                          {t('صيانة', 'Maint.')}
                        </button>
                      )}
                      {inst.status !== 'loaned' && (
                        <button
                          onClick={() => handleDelete(inst)}
                          className="text-[10px] font-bold py-1 px-2 rounded bg-white dark:bg-slate-900 hover:bg-red-50 text-red-600 border border-slate-200 dark:border-slate-700"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('إغلاق', 'Close')}</Button>
        </DialogFooter>

        {showQrFor && (
          <InstanceQrDialog instance={showQrFor} boxName={box.name} onClose={() => setShowQrFor(null)} t={t} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════
// Loan Box Dialog (single student, optional specific instance)
// ════════════════════════════════════════════════════════════════════
function LoanBoxDialog({ box, students, adminHeaders, onClose, onSuccess, t, lang, toast }: any) {
  const [studentId, setStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [instances, setInstances] = useState<BoxInstance[]>([]);
  const [instanceId, setInstanceId] = useState<number | null>(null);

  useEffect(() => {
    fetch(apiUrl(`/api/boxes/${box.id}/instances`))
      .then(r => r.json())
      .then(d => {
        if (d.status === 'success') {
          const list = (d.data || []).filter((i: BoxInstance) => i.status === 'available');
          setInstances(list);
        }
      });
  }, [box.id]);

  const selectedStudent = students.find((s: Student) => s.universityId === studentId);
  const filteredStudents = students.filter((s: Student) =>
    !studentSearch || s.name.includes(studentSearch) || s.universityId.includes(studentSearch)
  ).slice(0, 6);

  const handleSubmit = async () => {
    if (!studentId) {
      toast({ title: t('اختر الطالب', 'Select a student'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/box-loans'), {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          boxId: box.id,
          instanceId: instanceId || undefined,
          studentId,
          studentName: selectedStudent?.name || '',
          returnDate,
          notes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: t('تم صرف البوكس ✅', 'Box loaned ✅'),
          description: data.data?.instanceLabel ? `🏷 ${data.data.instanceLabel}` : undefined,
        });
        onSuccess();
      } else {
        toast({ title: data.message || t('خطأ', 'Error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('فشل الاتصال', 'Network error'), variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            {t('صرف نسخة بوكس', 'Loan a Box Instance')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300 font-bold mb-1">{t('البوكس', 'Box')}</p>
            <p className="font-black text-slate-900 dark:text-white">{box.name}</p>
            <p className="text-xs text-slate-500 font-mono">
              {box.code_prefix} · {box.items_count} {t('قطعة', 'items')} · {instances.length} {t('متاح', 'available')}
            </p>
          </div>

          <div>
            <Label className="font-bold mb-1.5 block">{t('النسخة', 'Instance')}</Label>
            <select
              value={instanceId ?? ''}
              onChange={e => setInstanceId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 dark:text-white"
            >
              <option value="">⚡ {t('اختيار تلقائي (أقدم نسخة متاحة)', 'Auto-pick (oldest available)')}</option>
              {instances.map(i => (
                <option key={i.id} value={i.id}>{i.label} ({i.qr_code})</option>
              ))}
            </select>
          </div>

          <div>
            <Label className="font-bold mb-1.5 block">{t('الطالب', 'Student')}</Label>
            {selectedStudent ? (
              <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">{selectedStudent.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{selectedStudent.universityId}</p>
                </div>
                <button onClick={() => setStudentId('')} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  placeholder={t('ابحث بالاسم أو الرقم...', 'Search by name or ID...')}
                />
                {studentSearch && filteredStudents.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredStudents.map((s: Student) => (
                      <button
                        key={s.universityId}
                        onClick={() => { setStudentId(s.universityId); setStudentSearch(''); }}
                        className="w-full px-3 py-2 text-sm text-left rtl:text-right hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <div className="font-bold text-slate-800 dark:text-white">{s.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{s.universityId}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label className="font-bold mb-1.5 block">{t('تاريخ الإرجاع المتوقع', 'Expected Return Date')}</Label>
            <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
          </div>

          <div>
            <Label className="font-bold mb-1.5 block">{t('ملاحظات (اختياري)', 'Notes (optional)')}</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 dark:text-white resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{t('إلغاء', 'Cancel')}</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {t('تأكيد الصرف', 'Confirm Loan')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════
// Bulk Distribute Dialog
// ════════════════════════════════════════════════════════════════════
function BulkDistributeDialog({ box, students, adminHeaders, onClose, onSuccess, t, lang, toast }: any) {
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [availableCount, setAvailableCount] = useState<number>(box.available_instances || 0);

  useEffect(() => {
    fetch(apiUrl(`/api/boxes/${box.id}/instances`))
      .then(r => r.json())
      .then(d => {
        if (d.status === 'success') {
          setAvailableCount((d.data || []).filter((i: BoxInstance) => i.status === 'available').length);
        }
      });
  }, [box.id]);

  const filteredStudents = students.filter((s: Student) =>
    (!studentSearch || s.name.includes(studentSearch) || s.universityId.includes(studentSearch)) &&
    !selectedStudents.find(x => x.universityId === s.universityId)
  ).slice(0, 8);

  const addStudent = (s: Student) => {
    if (selectedStudents.length >= availableCount) {
      toast({
        title: t('وصلت للحد الأقصى', 'Limit reached'),
        description: t(`متاح فقط ${availableCount} نسخة`, `Only ${availableCount} available`),
        variant: 'destructive',
      });
      return;
    }
    setSelectedStudents([...selectedStudents, s]);
    setStudentSearch('');
  };

  const removeStudent = (uid: string) =>
    setSelectedStudents(selectedStudents.filter(s => s.universityId !== uid));

  const handleSubmit = async () => {
    if (selectedStudents.length === 0) {
      toast({ title: t('أضف طالباً واحداً على الأقل', 'Add at least one student'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/box-loans/bulk'), {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          boxId: box.id,
          returnDate,
          notes,
          students: selectedStudents.map(s => ({
            studentId: s.universityId,
            studentName: s.name,
          })),
        }),
      });
      const data = await res.json();
      const success = data.data?.success || [];
      const errors = data.data?.errors || [];
      if (success.length > 0) {
        toast({
          title: t(`تم توزيع ${success.length} بوكس ✅`, `Distributed ${success.length} ✅`),
          description: errors.length > 0 ? t(`فشل ${errors.length}`, `${errors.length} failed`) : undefined,
        });
        onSuccess();
      } else {
        toast({
          title: t('فشل التوزيع', 'Distribution failed'),
          description: errors[0]?.message || data.message,
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: t('فشل الاتصال', 'Network error'), variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <Users className="w-6 h-6" />
            {t('توزيع جماعي للبوكس', 'Bulk Distribute')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">{t('البوكس', 'Box')}</p>
              <p className="font-black text-slate-900 dark:text-white">{box.name}</p>
              <p className="text-xs text-slate-500 font-mono">{box.code_prefix} · {box.items_count} {t('قطعة لكل نسخة', 'items each')}</p>
            </div>
            <div className="text-center bg-white dark:bg-slate-900 rounded-xl p-2 border border-emerald-200 dark:border-emerald-800">
              <div className="text-2xl font-black text-emerald-600">{availableCount}</div>
              <div className="text-[9px] font-bold text-emerald-700">{t('متاح', 'available')}</div>
            </div>
          </div>

          <div>
            <Label className="font-bold mb-1.5 block flex items-center justify-between">
              <span>{t('الطلاب المستفيدون', 'Recipient Students')}</span>
              <span className="text-xs font-mono bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                {selectedStudents.length} / {availableCount}
              </span>
            </Label>
            <div className="relative">
              <Input
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                placeholder={t('ابحث بالاسم أو الرقم لإضافة طالب...', 'Search by name or ID to add student...')}
                disabled={selectedStudents.length >= availableCount}
              />
              {studentSearch && filteredStudents.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredStudents.map((s: Student) => (
                    <button
                      key={s.universityId}
                      onClick={() => addStudent(s)}
                      className="w-full px-3 py-2 text-sm text-left rtl:text-right hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-800 dark:text-white">{s.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{s.universityId}</div>
                      </div>
                      <Plus size={14} className="text-emerald-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
              {selectedStudents.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                  <Users className="w-10 h-10 mx-auto text-slate-300 mb-1" />
                  <p className="text-xs font-bold text-slate-400">{t('لم يُضف طلاب بعد', 'No students added yet')}</p>
                </div>
              ) : selectedStudents.map((s, idx) => (
                <div key={s.universityId} className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{s.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{s.universityId}</div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded">
                    ⚡ {t('نسخة تلقائية', 'auto instance')}
                  </span>
                  <button onClick={() => removeStudent(s.universityId)} className="text-red-500 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="font-bold mb-1.5 block">{t('تاريخ الإرجاع المتوقع', 'Expected Return Date')}</Label>
            <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
          </div>

          <div>
            <Label className="font-bold mb-1.5 block">{t('ملاحظات (اختياري)', 'Notes (optional)')}</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 dark:text-white resize-none"
              placeholder={t('مثلاً: معسكر تطوير الويب', 'e.g. Web dev camp')}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{t('إلغاء', 'Cancel')}</Button>
          <Button onClick={handleSubmit} disabled={submitting || selectedStudents.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            {t(`توزيع على ${selectedStudents.length} طالب`, `Distribute to ${selectedStudents.length}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════
// Return Checklist Dialog (unchanged behaviour)
// ════════════════════════════════════════════════════════════════════
function ReturnChecklistDialog({ loan, adminHeaders, onClose, onSuccess, t, lang, toast }: any) {
  const [details, setDetails] = useState<any>(null);
  const [checks, setChecks] = useState<any[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(apiUrl(`/api/box-loans/${loan.id}`))
      .then(r => r.json())
      .then(d => {
        if (d.status === 'success') {
          setDetails(d.data);
          setChecks(
            (d.data.expected_items || []).map((it: any) => ({
              itemName: it.item_name,
              quantityExpected: it.quantity_required,
              quantityReturned: it.quantity_required,
              condition: 'good',
              notes: '',
              imageUrl: it.imageUrl,
            }))
          );
        }
      });
  }, [loan.id]);

  const updateCheck = (idx: number, patch: any) =>
    setChecks(checks.map((c, i) => i === idx ? { ...c, ...patch } : c));

  const setAllGood = () =>
    setChecks(checks.map(c => ({ ...c, quantityReturned: c.quantityExpected, condition: 'good' })));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/box-loans/${loan.id}/return`), {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ checks, generalNotes }),
      });
      const data = await res.json();
      if (res.ok) {
        const final = data.data?.finalStatus;
        toast({
          title: final === 'returned'
            ? t('تم الإرجاع كاملاً ✅', 'Fully returned ✅')
            : t('تم الإرجاع — يوجد نقص ⚠️', 'Returned — items missing ⚠️'),
        });
        onSuccess();
      } else {
        toast({ title: data.message || t('خطأ', 'Error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('فشل الاتصال', 'Network error'), variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  if (!details) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900">
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        </DialogContent>
      </Dialog>
    );
  }

  const allGood = checks.every(c => c.condition === 'good' && c.quantityReturned === c.quantityExpected);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6" />
            {t('تحقق من إرجاع البوكس', 'Verify Box Return')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-slate-500">{t('البوكس:', 'Box:')}</span> <span className="font-bold">{loan.box_name}</span></div>
            <div><span className="text-slate-500">{t('النسخة:', 'Instance:')}</span> <span className="font-bold font-mono text-blue-600">{loan.instance_label || '—'}</span></div>
            <div><span className="text-slate-500">{t('الطالب:', 'Student:')}</span> <span className="font-bold">{loan.student_name}</span></div>
            <div><span className="text-slate-500">{t('متوقع:', 'Due:')}</span> <span className="font-mono">{loan.expected_return_date}</span></div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="font-black text-base">{t('قائمة التحقق', 'Checklist')}</Label>
            <Button onClick={setAllGood} variant="outline" size="sm" className="text-xs gap-1">
              <CheckCircle2 size={14} /> {t('تأكيد الكل سليم', 'Mark all good')}
            </Button>
          </div>

          <div className="space-y-2">
            {checks.map((chk, idx) => {
              const isMissing = chk.quantityReturned < chk.quantityExpected || chk.condition === 'missing';
              const isDamaged = chk.condition === 'damaged';
              return (
                <div key={idx} className={`p-3 rounded-xl border ${
                  chk.condition === 'good' && chk.quantityReturned === chk.quantityExpected
                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                    : isMissing ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                    : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {chk.imageUrl
                      ? <img src={chk.imageUrl} alt="" className="w-7 h-7 rounded object-cover" />
                      : <Package size={14} className="text-slate-500" />}
                    <span className="font-bold text-sm flex-1 text-slate-900 dark:text-white">{chk.itemName}</span>
                    <span className="text-xs text-slate-500 font-mono">{t('المتوقع:', 'Expected:')} {chk.quantityExpected}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-slate-500 mb-1">{t('المُسلّم', 'Returned')}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={chk.quantityExpected}
                        value={chk.quantityReturned}
                        onChange={e => updateCheck(idx, { quantityReturned: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="h-8 text-center text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-[10px] text-slate-500 mb-1">{t('الحالة', 'Condition')}</Label>
                      <div className="flex gap-1">
                        {[
                          { k: 'good',    ar: 'سليم', en: 'Good',    color: 'emerald' },
                          { k: 'damaged', ar: 'تالف', en: 'Damaged', color: 'amber' },
                          { k: 'missing', ar: 'مفقود',en: 'Missing', color: 'red' },
                        ].map(opt => (
                          <button
                            key={opt.k}
                            onClick={() => updateCheck(idx, {
                              condition: opt.k,
                              quantityReturned: opt.k === 'missing' ? 0 : chk.quantityReturned,
                            })}
                            className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-bold border transition-all ${
                              chk.condition === opt.k
                                ? `bg-${opt.color}-600 text-white border-${opt.color}-600`
                                : `bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700`
                            }`}
                          >
                            {t(opt.ar, opt.en)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {(isMissing || isDamaged) && (
                    <Input
                      value={chk.notes}
                      onChange={e => updateCheck(idx, { notes: e.target.value })}
                      placeholder={t('ملاحظة عن الحالة...', 'Note about the condition...')}
                      className="mt-2 h-8 text-xs"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <Label className="font-bold mb-1.5 block">{t('ملاحظات عامة', 'General Notes')}</Label>
            <textarea
              value={generalNotes}
              onChange={e => setGeneralNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 dark:text-white resize-none"
              placeholder={t('أي ملاحظات إضافية...', 'Any additional notes...')}
            />
          </div>

          <div className={`p-3 rounded-xl border-2 ${allGood
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'}`}>
            <div className="flex items-center gap-2">
              {allGood ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
              <span className="text-sm font-bold">
                {allGood
                  ? t('كل القطع سليمة وكاملة ✅', 'All items present and good ✅')
                  : t('يوجد نقص أو تلف — سيُحفظ كإرجاع جزئي', 'Missing/damaged items detected — will be saved as partial return')}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{t('إلغاء', 'Cancel')}</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {t('تأكيد الإرجاع', 'Confirm Return')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════
// Batch Distribute Dialog — توزيع لدفعة كاملة
// ════════════════════════════════════════════════════════════════════
interface Batch { id: number; name: string; code: string; department: string; student_count?: number; }
interface BatchStudent { universityId: string; name: string; }

function BatchDistributeDialog({ box, adminHeaders, onClose, onSuccess, t, lang, toast }: any) {
  const [batches, setBatches]       = useState<Batch[]>([]);
  const [batchId, setBatchId]       = useState<number | null>(null);
  const [students, setStudents]     = useState<BatchStudent[]>([]);
  const [loadingB, setLoadingB]     = useState(true);
  const [loadingS, setLoadingS]     = useState(false);
  const [availCount, setAvailCount] = useState<number>(box.available_instances || 0);
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load batches + available instance count
  useEffect(() => {
    Promise.all([
      fetch(apiUrl('/api/admin/batches')).then(r => r.json()),
      fetch(apiUrl(`/api/boxes/${box.id}/instances`)).then(r => r.json()),
    ]).then(([bData, iData]) => {
      if (bData.status === 'success') setBatches(bData.data || []);
      if (iData.status === 'success')
        setAvailCount((iData.data || []).filter((i: any) => i.status === 'available').length);
    }).finally(() => setLoadingB(false));
  }, [box.id]);

  // Load students when batch selected
  useEffect(() => {
    if (!batchId) { setStudents([]); return; }
    setLoadingS(true);
    fetch(apiUrl(`/api/admin/batches/${batchId}/students`))
      .then(r => r.json())
      .then(d => { if (d.status === 'success') setStudents(d.data || []); })
      .finally(() => setLoadingS(false));
  }, [batchId]);

  const selectedBatch = batches.find(b => b.id === batchId);
  const canDistribute = students.length > 0 && availCount >= students.length;
  const shortage      = students.length > availCount ? students.length - availCount : 0;

  const handleSubmit = async () => {
    if (!batchId || students.length === 0) return;
    if (shortage > 0) {
      toast({
        title: t('نسخ غير كافية', 'Not enough instances'),
        description: t(`تحتاج ${shortage} نسخة إضافية`, `Need ${shortage} more instances`),
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/box-loans/bulk'), {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          boxId: box.id,
          returnDate,
          notes: notes || `دفعة: ${selectedBatch?.name}`,
          students: students.map(s => ({ studentId: s.universityId, studentName: s.name })),
        }),
      });
      const data = await res.json();
      const success = data.data?.success || [];
      const errors  = data.data?.errors  || [];
      if (success.length > 0) {
        toast({
          title: t(`تم التوزيع على ${success.length} طالب ✅`, `Distributed to ${success.length} students ✅`),
          description: errors.length > 0 ? t(`فشل ${errors.length}`, `${errors.length} failed`) : undefined,
        });
        onSuccess();
      } else {
        toast({ title: data.message || t('فشل التوزيع', 'Distribution failed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('فشل الاتصال', 'Network error'), variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-violet-700 dark:text-violet-300 flex items-center gap-2">
            <GraduationCap className="w-6 h-6" />
            {t('توزيع لدفعة كاملة', 'Distribute to Batch')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Box summary */}
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-violet-700 dark:text-violet-300">{t('البوكس', 'Box')}</p>
              <p className="font-black text-slate-900 dark:text-white">{box.name}</p>
              <p className="text-xs text-slate-500 font-mono">{box.code_prefix} · {box.items_count} {t('قطعة لكل نسخة', 'items each')}</p>
            </div>
            <div className="text-center bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-violet-200 dark:border-violet-800 min-w-[64px]">
              <div className="text-2xl font-black text-violet-600">{availCount}</div>
              <div className="text-[9px] font-bold text-violet-700 dark:text-violet-300">{t('متاح', 'available')}</div>
            </div>
          </div>

          {/* Batch selector */}
          <div>
            <Label className="font-bold mb-1.5 block flex items-center gap-1.5">
              <GraduationCap size={14} /> {t('اختر الدفعة', 'Select batch')}
            </Label>
            {loadingB ? (
              <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
            ) : batches.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">{t('لا توجد دفعات', 'No batches found')}</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {batches.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setBatchId(b.id === batchId ? null : b.id)}
                    className={`w-full text-start p-3 rounded-xl border transition-all flex items-center justify-between ${
                      batchId === b.id
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-violet-400'
                    }`}
                  >
                    <div>
                      <p className={`font-black text-sm ${batchId === b.id ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{b.name}</p>
                      <p className={`text-[10px] font-mono ${batchId === b.id ? 'text-violet-200' : 'text-slate-400'}`}>
                        {b.code}{b.department ? ` · ${b.department}` : ''}
                      </p>
                    </div>
                    {b.student_count !== undefined && (
                      <span className={`text-xs font-black px-2 py-1 rounded-lg ${
                        batchId === b.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}>
                        {b.student_count} {t('طالب', 'students')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Students preview */}
          {batchId && (
            <div>
              <Label className="font-bold mb-1.5 block">{t('طلاب الدفعة', 'Batch students')}</Label>
              {loadingS ? (
                <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
              ) : students.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                  <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-400">{t('لا يوجد طلاب في هذه الدفعة', 'No students in this batch')}</p>
                </div>
              ) : (
                <>
                  {/* Count check */}
                  <div className={`flex items-center justify-between p-3 rounded-xl border mb-3 ${
                    shortage > 0
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                  }`}>
                    <div className="flex items-center gap-2 text-sm">
                      {shortage > 0
                        ? <AlertTriangle size={16} className="text-red-600" />
                        : <CheckCircle2 size={16} className="text-emerald-600" />}
                      <span className={`font-bold ${shortage > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {shortage > 0
                          ? t(`نقص ${shortage} نسخة — أضف المزيد من نسخ البوكس`, `Short ${shortage} instances — add more instances`)
                          : t(`${students.length} طالب · ${availCount} نسخة متاحة ✅`, `${students.length} students · ${availCount} available ✅`)}
                      </span>
                    </div>
                  </div>
                  {/* Students list */}
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {students.map((s, i) => (
                      <div key={s.universityId} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs">
                        <span className="w-5 h-5 rounded-full bg-violet-600 text-white font-black flex items-center justify-center text-[10px]">{i + 1}</span>
                        <span className="flex-1 font-bold text-slate-800 dark:text-white truncate">{s.name}</span>
                        <span className="font-mono text-slate-400">{s.universityId}</span>
                        <span className="text-[10px] font-bold text-violet-600">⚡ {t('تلقائي', 'auto')}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <Label className="font-bold mb-1.5 block">{t('تاريخ الإرجاع المتوقع', 'Expected Return Date')}</Label>
            <input
              type="date"
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <Label className="font-bold mb-1.5 block">{t('ملاحظات (اختياري)', 'Notes (optional)')}</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 dark:text-white resize-none"
              placeholder={selectedBatch ? t(`دفعة: ${selectedBatch.name}`, `Batch: ${selectedBatch.name}`) : ''}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{t('إلغاء', 'Cancel')}</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !batchId || students.length === 0 || shortage > 0}
            className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
            {t(`توزيع على ${students.length} طالب`, `Distribute to ${students.length}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════
// QR Scanner Dialog
// ════════════════════════════════════════════════════════════════════
function QrScannerDialog({ onClose, t, lang }: any) {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const scannedRef = useRef(false);

  const lookup = async (code: string) => {
    if (!code.trim() || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(apiUrl(`/api/box-instances/qr/${encodeURIComponent(code.trim())}`));
      const data = await res.json();
      if (res.ok) setResult(data.data);
      else setError(data.message || t('الكود غير موجود', 'Code not found'));
    } catch {
      setError(t('فشل الاتصال', 'Network error'));
    } finally { setLoading(false); }
  };

  const handleScan = (codes: any[]) => {
    if (scannedRef.current || !codes?.length) return;
    const code = codes[0]?.rawValue;
    if (!code) return;
    scannedRef.current = true;
    lookup(code);
  };

  const statusCfg = result ? STATUS_CONFIG[result.status] : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black flex items-center gap-2 text-purple-700 dark:text-purple-300">
            <ScanLine className="w-6 h-6" />
            {t('مسح رمز QR', 'Scan QR Code')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode toggle */}
          <div className="flex gap-2">
            {[
              { k: 'camera', ar: 'كاميرا', en: 'Camera' },
              { k: 'manual', ar: 'إدخال يدوي', en: 'Manual entry' },
            ].map(m => (
              <button key={m.k} onClick={() => { setMode(m.k as any); scannedRef.current = false; setResult(null); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                  mode === m.k ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}>{t(m.ar, m.en)}</button>
            ))}
          </div>

          {mode === 'camera' && !result && (
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <Scanner
                onScan={handleScan}
                onError={(err: any) => setError(String(err))}
                constraints={{ facingMode: 'environment' }}
                components={{ audio: false }}
              />
              <p className="text-center text-xs text-slate-500 py-2">{t('وجّه الكاميرا نحو رمز QR الخاص بالنسخة', 'Point camera at the instance QR code')}</p>
            </div>
          )}

          {mode === 'manual' && !result && (
            <div className="flex gap-2">
              <Input
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookup(manualCode)}
                placeholder={t('أدخل رمز QR مثلاً ARD-001', 'Enter QR code e.g. ARD-001')}
                dir="ltr"
                autoFocus
              />
              <Button onClick={() => lookup(manualCode)} disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white gap-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search size={14} />}
                {t('بحث', 'Search')}
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-6"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400 font-bold flex items-center gap-2">
              <AlertTriangle size={16} /> {error}
              <button onClick={() => { setError(''); scannedRef.current = false; }} className="ms-auto text-xs underline">{t('إعادة المحاولة', 'Retry')}</button>
            </div>
          )}

          {result && statusCfg && (
            <div className={`rounded-xl border p-4 space-y-3 ${statusCfg.bg}`}>
              <div className="flex items-start gap-3">
                {result.image_url ? (
                  <img src={result.image_url} alt="" className="w-14 h-14 rounded-lg object-contain bg-white p-1 border border-slate-200" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 flex items-center justify-center">
                    <BoxIcon size={24} className="text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-900 dark:text-white">{result.box_name}</h3>
                  <p className="font-mono text-sm font-bold text-blue-600 mt-0.5">🏷 {result.label}</p>
                  <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${statusCfg.color}`}>
                    {t(statusCfg.ar, statusCfg.en)}
                  </span>
                </div>
              </div>

              {result.active_student_name ? (
                <div className="bg-white/70 dark:bg-slate-900/50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <UserIcon size={12} /> {result.active_student_name}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">{result.active_student_id}</p>
                  {result.active_return_date && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Calendar size={10} /> {t('إرجاع:', 'Due:')} {result.active_return_date}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-emerald-700 dark:text-emerald-300 font-bold text-center">
                  ✅ {t('النسخة متاحة — لا أحد يحملها', 'Instance is available — not currently loaned')}
                </p>
              )}

              <button
                onClick={() => { setResult(null); setError(''); scannedRef.current = false; setManualCode(''); }}
                className="w-full text-xs font-bold py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                {t('مسح كود آخر', 'Scan another code')}
              </button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('إغلاق', 'Close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════
// Per-instance QR Dialog
// ════════════════════════════════════════════════════════════════════
function InstanceQrDialog({ instance, boxName, onClose, t }: any) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(instance.qr_code)}`;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-white dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            {t('رمز النسخة', 'Instance QR Code')}
          </DialogTitle>
        </DialogHeader>
        <div className="text-center space-y-3 py-3">
          <p className="font-bold text-slate-600 dark:text-slate-400 text-sm">{boxName}</p>
          <p className="font-black text-2xl text-blue-600 font-mono">{instance.label}</p>
          <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block">
            <img src={qrUrl} alt="QR" className="w-64 h-64 mx-auto" />
          </div>
          <p className="text-xs font-mono text-slate-500">{instance.qr_code}</p>
          <p className="text-xs text-slate-400">{t('اطبع الكود وألصقه على النسخة', 'Print and attach to this instance')}</p>
        </div>
        <DialogFooter>
          <Button onClick={() => window.open(qrUrl, '_blank')} variant="outline" className="gap-2">
            <Eye size={14} /> {t('فتح للطباعة', 'Open to print')}
          </Button>
          <Button onClick={onClose}>{t('إغلاق', 'Close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
