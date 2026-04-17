import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '../../LanguageContext';
import { apiUrl } from '@/lib/api';
import {
  Users, Plus, Pencil, Trash2, Mail, Send, CheckCircle2, X,
  Calendar, Package, MapPin, Zap, Eye, RefreshCcw,
  BookOpen, ChevronDown, ChevronRight, UserPlus, FileText, Clock, Search,
  Copy, Upload, AlertTriangle, ShieldCheck, BarChart3, GraduationCap,
  Ban, Star, ArrowUpRight, MoreHorizontal, Layers
} from 'lucide-react';

interface Batch {
  id: number;
  name: string;
  code: string;
  department: string;
  is_active: number;
  auto_approve: number;
  can_view_locations: number;
  can_borrow: number;
  expires_at: string | null;
  created_at: string;
  student_count: number;
  active_loans: number;
}

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
}

interface Student {
  universityId: string;
  name: string;
  email?: string;
  batch_id?: number;
  isBanned?: boolean;
  active_loans?: number;
  overdue_loans?: number;
}

const emptyBatch = {
  name: '', code: '', department: '',
  is_active: 1, auto_approve: 0, can_view_locations: 0, can_borrow: 1,
  expires_at: ''
};

/* ─── Toggle button component ─── */
const PermToggle = ({
  value, onChange, label, icon: Icon, activeColor, activeBg
}: {
  value: boolean; onChange: (v: boolean) => void; label: string;
  icon: React.ElementType; activeColor: string; activeBg: string;
}) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border-2 text-sm font-bold transition-all duration-200 w-full ${
      value
        ? `${activeBg} ${activeColor} border-current shadow-sm`
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
    }`}
  >
    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${value ? 'bg-white/50 dark:bg-black/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
      <Icon className="w-4 h-4" />
    </div>
    <span className="flex-1 text-start">{label}</span>
    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${value ? 'bg-white/60 dark:bg-black/30' : 'bg-slate-200 dark:bg-slate-600'}`}>
      {value
        ? <CheckCircle2 className="w-3.5 h-3.5" />
        : <X className="w-3 h-3 opacity-50" />}
    </div>
  </button>
);

const AdminBatches = () => {
  const { lang, t } = useLanguage();
  const { toast } = useToast();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null);

  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchForm, setBatchForm] = useState(emptyBatch);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTargetBatch, setEmailTargetBatch] = useState<Batch | null>(null);
  const [emailForm, setEmailForm] = useState({ subject: '', body: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailPreviewMode, setEmailPreviewMode] = useState(false);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetBatch, setAssignTargetBatch] = useState<Batch | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '' });

  const [deleteConfirm, setDeleteConfirm] = useState<Batch | null>(null);
  const [batchStudentsData, setBatchStudentsData] = useState<Record<number, Student[]>>({});
  const [loadingStudents, setLoadingStudents] = useState<number | null>(null);
  const [removingStudent, setRemovingStudent] = useState<string | null>(null);
  const [studentEmailModal, setStudentEmailModal] = useState<Student | null>(null);
  const [studentEmailForm, setStudentEmailForm] = useState({ subject: '', body: '' });
  const [batchSearch, setBatchSearch] = useState('');
  const [expandedStudentSearch, setExpandedStudentSearch] = useState('');
  const [togglingBatch, setTogglingBatch] = useState<number | null>(null);
  const [cloningBatch, setCloningBatch] = useState<number | null>(null);

  const [csvBatchModalOpen, setCsvBatchModalOpen] = useState(false);
  const [csvBatchTarget, setCsvBatchTarget] = useState<Batch | null>(null);
  const [csvBatchText, setCsvBatchText] = useState('');
  const [csvBatchPreview, setCsvBatchPreview] = useState<string[]>([]);
  const [importingBatchCSV, setImportingBatchCSV] = useState(false);

  /* ─── batch actions menu ─── */
  const [openMenuBatch, setOpenMenuBatch] = useState<number | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [bRes, tRes, uRes] = await Promise.all([
        fetch(apiUrl('/api/admin/batches')),
        fetch(apiUrl('/api/admin/email-templates')),
        fetch(apiUrl('/api/users')),
      ]);
      if (bRes.ok) { const d = await bRes.json(); setBatches(d.data || []); }
      if (tRes.ok) { const d = await tRes.json(); setTemplates(d.data || []); }
      if (uRes.ok) { const d = await uRes.json(); setStudents(d.data || []); }
    } catch { toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const fetchBatchStudents = async (batchId: number) => {
    setLoadingStudents(batchId);
    try {
      const res = await fetch(apiUrl(`/api/admin/batches/${batchId}/students`));
      const d = await res.json();
      if (res.ok) setBatchStudentsData(prev => ({ ...prev, [batchId]: d.data || [] }));
    } catch { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
    finally { setLoadingStudents(null); }
  };

  const removeStudentFromBatch = async (batchId: number, universityId: string) => {
    setRemovingStudent(universityId);
    try {
      const res = await fetch(apiUrl(`/api/admin/batches/${batchId}/remove-student`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universityId })
      });
      if (res.ok) { toast({ title: t('تم الإزالة ✅', 'Removed ✅') }); fetchBatchStudents(batchId); fetchAll(); }
    } catch { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
    finally { setRemovingStudent(null); }
  };

  const sendStudentEmail = async () => {
    if (!studentEmailModal || !studentEmailForm.subject || !studentEmailForm.body) return;
    try {
      const res = await fetch(apiUrl('/api/admin/send-custom-email'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: studentEmailModal.email, subject: studentEmailForm.subject, body: studentEmailForm.body.replace('{name}', studentEmailModal.name) })
      });
      if (res.ok) { toast({ title: t('تم الإرسال ✅', 'Sent ✅') }); setStudentEmailModal(null); setStudentEmailForm({ subject: '', body: '' }); }
    } catch { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const openAddBatch = () => { setEditingBatch(null); setBatchForm(emptyBatch); setBatchModalOpen(true); };
  const openEditBatch = (b: Batch) => {
    setEditingBatch(b);
    setBatchForm({ name: b.name, code: b.code, department: b.department, is_active: b.is_active, auto_approve: b.auto_approve, can_view_locations: b.can_view_locations, can_borrow: b.can_borrow, expires_at: b.expires_at || '' });
    setBatchModalOpen(true);
  };

  const saveBatch = async () => {
    if (!batchForm.name || !batchForm.code) {
      toast({ title: t('تنبيه', 'Warning'), description: t('الاسم والكود مطلوبان', 'Name and code are required'), variant: 'destructive' }); return;
    }
    try {
      const url = editingBatch ? apiUrl(`/api/admin/batches/${editingBatch.id}`) : apiUrl('/api/admin/batches');
      const method = editingBatch ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...batchForm, expires_at: batchForm.expires_at || null }) });
      if (res.ok) { toast({ title: t('تم الحفظ ✅', 'Saved ✅') }); setBatchModalOpen(false); fetchAll(); }
      else { const d = await res.json(); toast({ title: t('خطأ', 'Error'), description: d.message, variant: 'destructive' }); }
    } catch { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const deleteBatch = async (b: Batch) => {
    try {
      const res = await fetch(apiUrl(`/api/admin/batches/${b.id}`), { method: 'DELETE' });
      const d = await res.json();
      if (res.ok) { toast({ title: t('تم الحذف 🗑️', 'Deleted 🗑️') }); setDeleteConfirm(null); fetchAll(); }
      else toast({ title: t('خطأ', 'Error'), description: d.message, variant: 'destructive' });
    } catch { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const quickToggleActive = async (batch: Batch) => {
    setTogglingBatch(batch.id);
    try {
      const newValue = batch.is_active ? 0 : 1;
      const res = await fetch(apiUrl(`/api/admin/batches/${batch.id}`), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...batch, is_active: newValue, expires_at: batch.expires_at || null })
      });
      if (res.ok) { fetchAll(); toast({ title: newValue ? t('تم التفعيل ✅', 'Activated ✅') : t('تم الإيقاف', 'Deactivated') }); }
    } catch { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
    finally { setTogglingBatch(null); }
  };

  const cloneBatch = async (batch: Batch) => {
    setCloningBatch(batch.id);
    try {
      const res = await fetch(apiUrl('/api/admin/batches'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${t('نسخة من', 'Copy of')} ${batch.name}`, code: batch.code, department: batch.department, is_active: 0, auto_approve: batch.auto_approve, can_view_locations: batch.can_view_locations, can_borrow: batch.can_borrow, expires_at: batch.expires_at || null })
      });
      if (res.ok) { toast({ title: t('تم نسخ الدفعة ✅', 'Batch cloned ✅') }); fetchAll(); }
    } catch { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
    finally { setCloningBatch(null); }
  };

  const parseBatchCSV = (text: string): string[] =>
    text.trim().split('\n').map(l => l.trim().split(',')[0].trim()).filter(id => id.length > 0);

  const importBatchStudentsCSV = async () => {
    if (!csvBatchTarget || csvBatchPreview.length === 0) return;
    setImportingBatchCSV(true);
    let success = 0;
    for (const universityId of csvBatchPreview) {
      try {
        const res = await fetch(apiUrl(`/api/admin/batches/${csvBatchTarget.id}/assign-student`), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ universityId })
        });
        if (res.ok) success++;
      } catch { /* continue */ }
    }
    toast({ title: t(`تم تعيين ${success} من ${csvBatchPreview.length}`, `Assigned ${success}/${csvBatchPreview.length}`) });
    setImportingBatchCSV(false); setCsvBatchModalOpen(false); setCsvBatchText(''); setCsvBatchPreview([]); fetchAll();
  };

  const assignStudent = async (universityId: string) => {
    if (!assignTargetBatch) return;
    setAssigning(universityId);
    try {
      const res = await fetch(apiUrl(`/api/admin/batches/${assignTargetBatch.id}/assign-student`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universityId })
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: t('تم التعيين ✅', 'Assigned ✅'), description: t(`الرقم الأكاديمي: ${d.universityId}`, `Academic ID: ${d.universityId}`) });
        fetchAll();
      } else toast({ title: t('خطأ', 'Error'), description: d.message, variant: 'destructive' });
    } catch { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
    finally { setAssigning(null); }
  };

  const sendBatchEmail = async () => {
    if (!emailTargetBatch || !emailForm.subject || !emailForm.body) return;
    setSendingEmail(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/batches/${emailTargetBatch.id}/send-email`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailForm)
      });
      const d = await res.json();
      if (res.ok) { toast({ title: t(`تم الإرسال ✅ — ${d.sent} إيميل`, `Sent ✅ — ${d.sent} emails`) }); setEmailModalOpen(false); setEmailForm({ subject: '', body: '' }); }
      else toast({ title: t('خطأ', 'Error'), description: d.message, variant: 'destructive' });
    } catch { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
    finally { setSendingEmail(false); }
  };

  const saveTemplate = async () => {
    if (!templateForm.name || !templateForm.subject || !templateForm.body) return;
    try {
      const res = await fetch(apiUrl('/api/admin/email-templates'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTemplate ? { ...templateForm, id: editingTemplate.id } : templateForm)
      });
      if (res.ok) { toast({ title: t('تم الحفظ ✅', 'Saved ✅') }); setTemplateModalOpen(false); setEditingTemplate(null); setTemplateForm({ name: '', subject: '', body: '' }); fetchAll(); }
    } catch { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const deleteTemplate = async (id: number) => {
    try { await fetch(apiUrl(`/api/admin/email-templates/${id}`), { method: 'DELETE' }); fetchAll(); } catch { /* ignore */ }
  };

  const unassignedStudents = students.filter(s => !s.batch_id);
  const filteredBatches = batchSearch.trim()
    ? batches.filter(b => b.name.toLowerCase().includes(batchSearch.toLowerCase()) || b.code.includes(batchSearch) || (b.department || '').toLowerCase().includes(batchSearch.toLowerCase()))
    : batches;
  const filteredUnassigned = assignSearch.trim()
    ? unassignedStudents.filter(s => s.name.toLowerCase().includes(assignSearch.toLowerCase()) || s.universityId.includes(assignSearch))
    : unassignedStudents;

  const getBatchStatus = (batch: Batch) => {
    if (batch.expires_at && new Date(batch.expires_at) < new Date()) return 'expired';
    if (!batch.is_active) return 'inactive';
    return 'active';
  };

  const statusStyle = {
    active:   { border: 'border-l-4 border-l-emerald-500', dot: 'bg-emerald-500', label: t('نشطة', 'Active'), labelStyle: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    inactive: { border: 'border-l-4 border-l-slate-400',   dot: 'bg-slate-400',   label: t('متوقفة', 'Inactive'), labelStyle: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    expired:  { border: 'border-l-4 border-l-red-500',     dot: 'bg-red-500',     label: t('منتهية', 'Expired'), labelStyle: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  };

  /* ─── PERMISSIONS display config ─── */
  const permConfig = [
    { key: 'auto_approve',       icon: Zap,          label: t('موافقة فورية', 'Auto-Approve'), color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
    { key: 'is_active',          icon: Eye,          label: t('تظهر للتسجيل', 'Visible'),      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' },
    { key: 'can_view_locations', icon: MapPin,       label: t('رؤية المواقع', 'Locations'),    color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20' },
    { key: 'can_borrow',         icon: Package,      label: t('استعارة', 'Borrowing'),         color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' },
  ] as const;

  return (
    <div className="space-y-6 pb-10 font-sans" dir={lang === 'ar' ? 'rtl' : 'ltr'} onClick={() => setOpenMenuBatch(null)}>

      {/* ══════════ HEADER ══════════ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
            <GraduationCap className="w-6 h-6 text-white"/>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">{t('إدارة الدفعات', 'Batch Management')}</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">
              {batches.length} {t('دفعة', 'batches')} · {students.filter(s => s.batch_id).length} {t('طالب مُعيّن', 'assigned')}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', subject: '', body: '' }); setTemplateModalOpen(true); }}
            variant="outline" size="sm" className="gap-2 font-bold border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 h-10">
            <FileText className="w-4 h-4"/> {t('قوالب الإيميل', 'Email Templates')}
          </Button>
          <Button onClick={fetchAll} variant="outline" size="sm" className="gap-2 font-bold h-10 w-10 p-0" disabled={loading}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/>
          </Button>
          <Button onClick={openAddBatch} size="sm" className="gap-2 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md h-10 px-5">
            <Plus className="w-4 h-4"/> {t('دفعة جديدة', 'New Batch')}
          </Button>
        </div>
      </div>

      {/* ══════════ STATS ══════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('إجمالي الدفعات', 'Total Batches'),    value: batches.length,                                    icon: Layers,       grad: 'from-blue-500 to-indigo-600',  bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: t('دفعات نشطة', 'Active'),                value: batches.filter(b => b.is_active && !(b.expires_at && new Date(b.expires_at) < new Date())).length, icon: ShieldCheck, grad: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: t('طلاب مُعيّنون', 'Assigned Students'),  value: students.filter(s => s.batch_id).length,           icon: Users,        grad: 'from-purple-500 to-violet-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
          { label: t('غير مُعيّنين', 'Unassigned'),          value: unassignedStudents.length,                         icon: UserPlus,     grad: 'from-orange-500 to-amber-600',  bg: 'bg-orange-50 dark:bg-orange-900/20' },
        ].map(({ label, value, icon: Icon, grad, bg }) => (
          <div key={label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="w-5 h-5 text-white"/>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 leading-none mb-1">{label}</p>
              <p className="text-3xl font-black text-slate-800 dark:text-white leading-none">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ══════════ SEARCH ══════════ */}
      <div className="relative">
        <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${lang === 'ar' ? 'right-4' : 'left-4'}`}/>
        <input
          value={batchSearch}
          onChange={e => setBatchSearch(e.target.value)}
          placeholder={t('ابحث عن دفعة بالاسم أو الكود أو القسم...', 'Search batches by name, code or department...')}
          className={`w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all ${lang === 'ar' ? 'pr-11 pl-4' : 'pl-11 pr-4'}`}
        />
        {batchSearch && (
          <button onClick={() => setBatchSearch('')} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 ${lang === 'ar' ? 'left-4' : 'right-4'}`}>
            <X className="w-4 h-4"/>
          </button>
        )}
      </div>

      {/* ══════════ BATCHES LIST ══════════ */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"/>
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <GraduationCap className="w-10 h-10 text-blue-300 dark:text-blue-700"/>
          </div>
          <p className="font-black text-xl text-slate-500 dark:text-slate-400 mb-2">{t('لا توجد دفعات بعد', 'No batches yet')}</p>
          <p className="text-sm text-slate-400 mb-6">{t('أنشئ أول دفعة لبدء تنظيم الطلاب', 'Create your first batch to start organizing students')}</p>
          <Button onClick={openAddBatch} className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 h-11 px-8 shadow-md">
            <Plus className="w-4 h-4"/> {t('إنشاء أول دفعة', 'Create First Batch')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBatches.length === 0 && batchSearch && (
            <div className="text-center py-14 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <Search className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-3"/>
              <p className="font-black text-slate-400">{t('لا توجد نتائج لـ', 'No results for')} "{batchSearch}"</p>
              <button onClick={() => setBatchSearch('')} className="mt-2 text-sm text-blue-500 font-bold hover:underline">{t('مسح البحث', 'Clear')}</button>
            </div>
          )}

          {filteredBatches.map(batch => {
            const status     = getBatchStatus(batch);
            const ss         = statusStyle[status];
            const isExpanded = expandedBatch === batch.id;
            const permCount  = [batch.auto_approve, batch.can_borrow, batch.can_view_locations, batch.is_active].filter(Boolean).length;

            return (
              <div
                key={batch.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all hover:shadow-md ${ss.border} ${!batch.is_active && status !== 'expired' ? 'opacity-75' : ''}`}
              >
                {/* ── Card Header ── */}
                <div className="p-5">
                  <div className="flex flex-wrap items-start gap-4">

                    {/* Expand button */}
                    <button
                      onClick={() => {
                        const next = isExpanded ? null : batch.id;
                        setExpandedBatch(next);
                        if (next && !batchStudentsData[next]) fetchBatchStudents(next);
                        setExpandedStudentSearch('');
                      }}
                      className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors flex-shrink-0 mt-0.5"
                    >
                      {isExpanded
                        ? <ChevronDown className="w-5 h-5 text-blue-500"/>
                        : <ChevronRight className={`w-5 h-5 ${lang === 'ar' ? 'rotate-180' : ''}`}/>}
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Name row */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-black text-lg text-slate-800 dark:text-white">{batch.name}</h3>
                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border flex items-center gap-1 ${ss.labelStyle}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${ss.dot} inline-block`}/>
                          {ss.label}
                        </span>
                        <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                          {batch.code}XXX
                        </span>
                        {batch.department && (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                            {batch.department}
                          </span>
                        )}
                      </div>

                      {/* Stats row */}
                      <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-blue-500"/>
                          {batch.student_count} {t('طالب', 'students')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-emerald-500"/>
                          {batch.active_loans} {t('عهدة نشطة', 'active loans')}
                        </span>
                        {batch.expires_at && (
                          <span className={`flex items-center gap-1.5 ${status === 'expired' ? 'text-red-500' : ''}`}>
                            <Calendar className="w-3.5 h-3.5"/>
                            {status === 'expired' ? t('انتهت:', 'Expired:') : t('ينتهي:', 'Expires:')} {batch.expires_at}
                          </span>
                        )}
                        {batch.created_at && (
                          <span className="flex items-center gap-1.5 text-slate-300 dark:text-slate-600">
                            <Clock className="w-3.5 h-3.5"/>
                            {String(batch.created_at).slice(0, 10)}
                          </span>
                        )}
                      </div>

                      {/* Permission pills */}
                      <div className="flex flex-wrap gap-1.5">
                        {permConfig.map(({ key, icon: Icon, label, color }) => {
                          const active = !!(batch as any)[key];
                          return active ? (
                            <span key={key} className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full ${color}`}>
                              <Icon className="w-3 h-3"/> {label}
                            </span>
                          ) : null;
                        })}
                        {permCount === 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                            {t('لا صلاحيات', 'No permissions')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      {/* Primary actions */}
                      <Button size="sm" onClick={() => { setAssignTargetBatch(batch); setAssignSearch(''); setAssignModalOpen(true); }}
                        variant="outline" className="gap-1.5 font-bold h-9 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                        <UserPlus className="w-3.5 h-3.5"/> {t('تعيين', 'Assign')}
                      </Button>
                      <Button size="sm" onClick={() => { setEmailTargetBatch(batch); setEmailForm({ subject: '', body: '' }); setEmailPreviewMode(false); setEmailModalOpen(true); }}
                        variant="outline" className="gap-1.5 font-bold h-9 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20">
                        <Mail className="w-3.5 h-3.5"/> {t('إيميل', 'Email')}
                      </Button>

                      {/* Toggle active */}
                      <button
                        onClick={() => quickToggleActive(batch)}
                        disabled={togglingBatch === batch.id}
                        title={batch.is_active ? t('إيقاف الدفعة', 'Deactivate') : t('تفعيل الدفعة', 'Activate')}
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                          batch.is_active
                            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        {togglingBatch === batch.id
                          ? <RefreshCcw className="w-3.5 h-3.5 animate-spin"/>
                          : batch.is_active ? <ShieldCheck className="w-4 h-4"/> : <Ban className="w-4 h-4"/>}
                      </button>

                      {/* More menu */}
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setOpenMenuBatch(openMenuBatch === batch.id ? null : batch.id)}
                          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4"/>
                        </button>
                        {openMenuBatch === batch.id && (
                          <div className={`absolute top-11 ${lang === 'ar' ? 'left-0' : 'right-0'} z-50 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl min-w-[160px] py-1.5 animate-in fade-in zoom-in-95 duration-100`}>
                            <button onClick={() => { openEditBatch(batch); setOpenMenuBatch(null); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                              <Pencil className="w-3.5 h-3.5 text-slate-400"/> {t('تعديل', 'Edit')}
                            </button>
                            <button onClick={() => { setCsvBatchTarget(batch); setCsvBatchText(''); setCsvBatchPreview([]); setCsvBatchModalOpen(true); setOpenMenuBatch(null); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors">
                              <Upload className="w-3.5 h-3.5"/> {t('استيراد CSV', 'Import CSV')}
                            </button>
                            <button onClick={() => { cloneBatch(batch); setOpenMenuBatch(null); }} disabled={cloningBatch === batch.id}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                              {cloningBatch === batch.id ? <RefreshCcw className="w-3.5 h-3.5 animate-spin"/> : <Copy className="w-3.5 h-3.5 text-slate-400"/>} {t('نسخ', 'Clone')}
                            </button>
                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"/>
                            <button onClick={() => { setDeleteConfirm(batch); setOpenMenuBatch(null); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 className="w-3.5 h-3.5"/> {t('حذف', 'Delete')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Expanded: Students Panel ── */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
                    <div className="p-5">
                      {/* Panel header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-500"/>
                          <h4 className="font-black text-sm text-slate-700 dark:text-slate-300">
                            {t('طلاب الدفعة', 'Batch Students')}
                          </h4>
                          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-full">
                            {batchStudentsData[batch.id]?.length ?? batch.student_count}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setAssignTargetBatch(batch); setAssignSearch(''); setAssignModalOpen(true); }}
                            className="h-8 text-xs gap-1 font-bold text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                            <UserPlus className="w-3 h-3"/> {t('إضافة', 'Add')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => fetchBatchStudents(batch.id)} disabled={loadingStudents === batch.id}
                            className="h-8 text-xs gap-1 font-bold border-slate-200 dark:border-slate-700">
                            <RefreshCcw className={`w-3 h-3 ${loadingStudents === batch.id ? 'animate-spin' : ''}`}/>
                            {t('تحديث', 'Refresh')}
                          </Button>
                        </div>
                      </div>

                      {/* Student search */}
                      {(batchStudentsData[batch.id]?.length ?? 0) > 4 && (
                        <div className="relative mb-4">
                          <Search className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 ${lang === 'ar' ? 'right-3' : 'left-3'}`}/>
                          <input
                            value={expandedStudentSearch}
                            onChange={e => setExpandedStudentSearch(e.target.value)}
                            placeholder={t('ابحث في طلاب الدفعة...', 'Search batch students...')}
                            className={`w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 ${lang === 'ar' ? 'pr-8 pl-3' : 'pl-8 pr-3'}`}
                          />
                          {expandedStudentSearch && (
                            <button onClick={() => setExpandedStudentSearch('')} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 ${lang === 'ar' ? 'left-3' : 'right-3'}`}>
                              <X className="w-3 h-3"/>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Students */}
                      {loadingStudents === batch.id ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"/>)}
                        </div>
                      ) : !batchStudentsData[batch.id] ? (
                        <div className="text-center py-8">
                          <p className="text-sm text-slate-400 font-bold">{t('اضغط تحديث لجلب الطلاب', 'Press refresh to load students')}</p>
                        </div>
                      ) : batchStudentsData[batch.id].length === 0 ? (
                        <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                          <Users className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-2"/>
                          <p className="text-sm text-slate-400 font-bold">{t('لا يوجد طلاب مُعيّنون بعد', 'No students assigned yet')}</p>
                          <button onClick={() => { setAssignTargetBatch(batch); setAssignSearch(''); setAssignModalOpen(true); }}
                            className="mt-3 text-xs font-bold text-blue-500 hover:underline flex items-center gap-1 mx-auto">
                            <UserPlus className="w-3 h-3"/> {t('تعيين طالب الآن', 'Assign a student now')}
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {(expandedStudentSearch.trim()
                            ? batchStudentsData[batch.id].filter(s =>
                                s.name.toLowerCase().includes(expandedStudentSearch.toLowerCase()) ||
                                s.universityId.includes(expandedStudentSearch))
                            : batchStudentsData[batch.id]
                          ).map(s => (
                            <div key={s.universityId} className={`bg-white dark:bg-slate-900 rounded-xl border p-3 flex items-center gap-3 transition-all hover:shadow-sm ${
                              s.isBanned ? 'border-red-200 dark:border-red-900/60' :
                              (s.overdue_loans ?? 0) > 0 ? 'border-orange-200 dark:border-orange-900/60' :
                              'border-slate-200 dark:border-slate-800'
                            }`}>
                              {/* Avatar */}
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 ${
                                s.isBanned ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                                'bg-gradient-to-br from-blue-400 to-indigo-500 text-white shadow-sm'
                              }`}>
                                {s.name.charAt(0)}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 flex-wrap mb-0.5">
                                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200 break-words leading-tight">{s.name}</p>
                                  {s.isBanned && <span className="text-[9px] font-black bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-md">{t('محظور', 'Banned')}</span>}
                                </div>
                                <p className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded w-fit mb-1">{s.universityId}</p>
                                <div className="flex gap-1.5 flex-wrap">
                                  {(s.active_loans ?? 0) > 0 && <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">{s.active_loans} {t('عهدة', 'loans')}</span>}
                                  {(s.overdue_loans ?? 0) > 0 && <span className="text-[9px] font-bold text-red-500">⚠ {s.overdue_loans} {t('متأخر', 'overdue')}</span>}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-1 flex-shrink-0">
                                {s.email && (
                                  <button onClick={() => { setStudentEmailModal(s); setStudentEmailForm({ subject: '', body: '' }); }}
                                    className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-500 flex items-center justify-center hover:bg-purple-100 transition-colors"
                                    title={t('إرسال إيميل', 'Send email')}>
                                    <Mail className="w-3.5 h-3.5"/>
                                  </button>
                                )}
                                <button onClick={() => removeStudentFromBatch(batch.id, s.universityId)}
                                  disabled={removingStudent === s.universityId}
                                  className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                                  title={t('إزالة من الدفعة', 'Remove')}>
                                  {removingStudent === s.universityId ? <RefreshCcw className="w-3.5 h-3.5 animate-spin"/> : <X className="w-3.5 h-3.5"/>}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════ ADD/EDIT BATCH MODAL ══════════ */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="max-w-lg font-sans p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader className="p-6 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editingBatch ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                {editingBatch ? <Pencil className="w-5 h-5 text-amber-600 dark:text-amber-400"/> : <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400"/>}
              </div>
              {editingBatch ? t('تعديل الدفعة', 'Edit Batch') : t('دفعة جديدة', 'New Batch')}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Name + Code */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">{t('اسم الدفعة', 'Batch Name')} *</Label>
                <Input value={batchForm.name} onChange={e => setBatchForm(f => ({...f, name: e.target.value}))}
                  placeholder={t('مثال: دفعة 2024', 'e.g. Batch 2024')}
                  className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 dark:text-white rounded-xl"/>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">{t('بادئة الرقم', 'ID Prefix')} *</Label>
                <Input value={batchForm.code} onChange={e => setBatchForm(f => ({...f, code: e.target.value}))}
                  placeholder="44600" dir="ltr"
                  className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 dark:text-white font-mono rounded-xl"/>
                <p className="text-[10px] text-slate-400">{t('أول طالب يحصل على', 'First student gets')} {batchForm.code || 'XX'}001</p>
              </div>
            </div>

            {/* Department + Expires */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">{t('القسم', 'Department')}</Label>
                <Input value={batchForm.department} onChange={e => setBatchForm(f => ({...f, department: e.target.value}))}
                  placeholder={t('برمجة، شبكات...', 'Software, Networks...')}
                  className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 dark:text-white rounded-xl"/>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">{t('تاريخ الانتهاء', 'Expires At')}</Label>
                <Input type="date" value={batchForm.expires_at} onChange={e => setBatchForm(f => ({...f, expires_at: e.target.value}))}
                  className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 dark:text-white rounded-xl" dir="ltr"/>
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-3">
              <Label className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5"/> {t('الصلاحيات', 'Permissions')}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <PermToggle value={!!batchForm.is_active}          onChange={v => setBatchForm(f => ({...f, is_active: v?1:0}))}          label={t('تظهر للتسجيل', 'Visible')}       icon={Eye}     activeColor="text-emerald-700 dark:text-emerald-300" activeBg="bg-emerald-50 dark:bg-emerald-900/25"/>
                <PermToggle value={!!batchForm.auto_approve}       onChange={v => setBatchForm(f => ({...f, auto_approve: v?1:0}))}       label={t('موافقة فورية', 'Auto-Approve')}  icon={Zap}     activeColor="text-amber-700 dark:text-amber-300"   activeBg="bg-amber-50 dark:bg-amber-900/25"/>
                <PermToggle value={!!batchForm.can_borrow}         onChange={v => setBatchForm(f => ({...f, can_borrow: v?1:0}))}         label={t('استعارة قطع', 'Borrowing')}      icon={Package} activeColor="text-blue-700 dark:text-blue-300"     activeBg="bg-blue-50 dark:bg-blue-900/25"/>
                <PermToggle value={!!batchForm.can_view_locations} onChange={v => setBatchForm(f => ({...f, can_view_locations: v?1:0}))} label={t('رؤية المواقع', 'Locations')}      icon={MapPin}  activeColor="text-purple-700 dark:text-purple-300" activeBg="bg-purple-50 dark:bg-purple-900/25"/>
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between gap-3">
            <Button variant="outline" onClick={() => setBatchModalOpen(false)} className="font-bold dark:text-white dark:border-slate-700 rounded-xl">{t('إلغاء', 'Cancel')}</Button>
            <Button onClick={saveBatch} className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 px-8 rounded-xl shadow-md">
              <CheckCircle2 className="w-4 h-4"/>
              {editingBatch ? t('حفظ التعديلات', 'Save Changes') : t('إنشاء الدفعة', 'Create Batch')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════ ASSIGN STUDENT MODAL ══════════ */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-md font-sans p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader className="p-5 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400"/>
              </div>
              {t('تعيين طالب للدفعة', 'Assign Student to Batch')}
            </DialogTitle>
            {assignTargetBatch && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                  {assignTargetBatch.name}
                </span>
                <span className="text-xs text-slate-400 font-bold">{unassignedStudents.length} {t('غير مُعيّن', 'unassigned')}</span>
              </div>
            )}
          </DialogHeader>
          <div className="p-4 flex flex-col gap-3" style={{ maxHeight: '65vh' }}>
            <div className="relative">
              <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${lang === 'ar' ? 'right-3' : 'left-3'}`}/>
              <Input value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                placeholder={t('ابحث باسم أو رقم الطالب...', 'Search by name or ID...')}
                className={`h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white rounded-xl ${lang === 'ar' ? 'pr-9' : 'pl-9'}`}/>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1 custom-scrollbar">
              {filteredUnassigned.length === 0 ? (
                <div className="text-center py-10">
                  <Users className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-2"/>
                  <p className="text-slate-400 font-bold text-sm">{t('لا يوجد طلاب غير مُعيّنين', 'No unassigned students')}</p>
                </div>
              ) : filteredUnassigned.map(s => (
                <div key={s.universityId} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 text-white font-black flex items-center justify-center text-sm flex-shrink-0 shadow-sm">{s.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200 break-words leading-tight">{s.name}</p>
                    <p className="text-[10px] font-mono text-slate-400">{s.universityId}</p>
                  </div>
                  <Button size="sm" onClick={() => assignStudent(s.universityId)} disabled={assigning === s.universityId}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-xs gap-1 flex-shrink-0 rounded-lg shadow-sm">
                    {assigning === s.universityId ? <RefreshCcw className="w-3 h-3 animate-spin"/> : <ArrowUpRight className="w-3 h-3"/>}
                    {t('تعيين', 'Assign')}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════ EMAIL MODAL ══════════ */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="max-w-lg font-sans p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader className="p-5 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400"/>
              </div>
              {t('إرسال إيميل للدفعة', 'Send Email to Batch')}
            </DialogTitle>
            {emailTargetBatch && (
              <p className="text-xs text-purple-500 font-bold mt-1.5">
                {emailTargetBatch.name} · {emailTargetBatch.student_count} {t('طالب', 'students')}
              </p>
            )}
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
              <button onClick={() => setEmailPreviewMode(false)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${!emailPreviewMode ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('تحرير', 'Edit')}</button>
              <button onClick={() => setEmailPreviewMode(true)}  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${emailPreviewMode  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('معاينة', 'Preview')}</button>
            </div>

            {emailPreviewMode ? (
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t('الموضوع', 'Subject')}</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{emailForm.subject || '—'}</p>
                </div>
                <div className="p-5 bg-white dark:bg-slate-900 min-h-[120px]">
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {(emailForm.body || '—').replace('{name}', t('محمد', 'Mohammed'))}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-400"/>
                  <p className="text-[10px] text-slate-400 font-bold">{t(`سيُرسل لـ ${emailTargetBatch?.student_count || 0} طالب`, `Sending to ${emailTargetBatch?.student_count || 0} students`)}</p>
                </div>
              </div>
            ) : (
              <>
                {templates.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{t('قوالب جاهزة', 'Templates')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {templates.map(tmpl => (
                        <button key={tmpl.id} onClick={() => setEmailForm({ subject: tmpl.subject, body: tmpl.body })}
                          className="text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors">
                          {tmpl.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">{t('الموضوع', 'Subject')}</Label>
                  <Input value={emailForm.subject} onChange={e => setEmailForm(f => ({...f, subject: e.target.value}))}
                    className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white rounded-xl"/>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    {t('النص', 'Body')} <span className="font-normal text-slate-400 normal-case tracking-normal">({'{name}'})</span>
                  </Label>
                  <textarea value={emailForm.body} onChange={e => setEmailForm(f => ({...f, body: e.target.value}))}
                    rows={6} className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                </div>
              </>
            )}
          </div>
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between gap-3">
            <Button variant="outline" onClick={() => { setEmailModalOpen(false); setEmailPreviewMode(false); }} className="font-bold dark:text-white dark:border-slate-700 rounded-xl">{t('إلغاء', 'Cancel')}</Button>
            <Button onClick={sendBatchEmail} disabled={sendingEmail || !emailForm.subject || !emailForm.body}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2 px-8 rounded-xl shadow-md">
              {sendingEmail ? <RefreshCcw className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
              {t('إرسال', 'Send')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════ EMAIL TEMPLATES MODAL ══════════ */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="max-w-2xl font-sans p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader className="p-5 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400"/>
              </div>
              {t('قوالب الإيميل', 'Email Templates')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-0 max-h-[70vh]">
            {/* Sidebar */}
            <div className="w-52 flex flex-col border-e border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex-shrink-0">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                <button onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', subject: '', body: '' }); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                  <Plus className="w-4 h-4"/> {t('قالب جديد', 'New')}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {templates.map(tmpl => (
                  <button key={tmpl.id}
                    onClick={() => { setEditingTemplate(tmpl); setTemplateForm({ name: tmpl.name, subject: tmpl.subject, body: tmpl.body }); }}
                    className={`w-full text-start p-3 rounded-xl transition-all ${editingTemplate?.id === tmpl.id ? 'bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}>
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{tmpl.name}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{tmpl.subject}</p>
                  </button>
                ))}
                {templates.length === 0 && <p className="text-xs text-slate-400 text-center py-6">{t('لا توجد قوالب', 'No templates')}</p>}
              </div>
            </div>

            {/* Form */}
            <div className="flex-1 p-5 space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">{t('اسم القالب', 'Template Name')}</Label>
                <Input value={templateForm.name} onChange={e => setTemplateForm(f => ({...f, name: e.target.value}))}
                  placeholder={t('مثال: ترحيب', 'e.g. Welcome')}
                  className="h-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white rounded-xl text-sm"/>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">{t('الموضوع', 'Subject')}</Label>
                <Input value={templateForm.subject} onChange={e => setTemplateForm(f => ({...f, subject: e.target.value}))}
                  className="h-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white rounded-xl text-sm"/>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">{t('النص', 'Body')}</Label>
                <textarea value={templateForm.body} onChange={e => setTemplateForm(f => ({...f, body: e.target.value}))}
                  rows={9} placeholder={t('يمكن استخدام {name} لاسم الطالب', 'Use {name} for student name')}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"/>
              </div>
              <div className="flex justify-between gap-2 pt-1">
                {editingTemplate && (
                  <Button onClick={() => deleteTemplate(editingTemplate.id)} variant="outline"
                    className="text-red-500 border-red-200 dark:border-red-900 hover:bg-red-50 font-bold gap-2 rounded-xl">
                    <Trash2 className="w-4 h-4"/> {t('حذف', 'Delete')}
                  </Button>
                )}
                <Button onClick={saveTemplate} className="bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2 mr-auto px-6 rounded-xl shadow-md">
                  <CheckCircle2 className="w-4 h-4"/> {t('حفظ', 'Save')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════ STUDENT EMAIL MODAL ══════════ */}
      {studentEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setStudentEmailModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center text-white font-black text-lg shadow-md">
                {studentEmailModal.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-black text-slate-800 dark:text-white">{studentEmailModal.name}</h3>
                <p className="text-xs text-slate-400">{studentEmailModal.email}</p>
              </div>
              <button onClick={() => setStudentEmailModal(null)} className="mr-auto ml-auto p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4"/>
              </button>
            </div>
            {templates.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {templates.map(tmpl => (
                  <button key={tmpl.id} onClick={() => setStudentEmailForm({ subject: tmpl.subject, body: tmpl.body })}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors">
                    {tmpl.name}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-3 mb-5">
              <Input value={studentEmailForm.subject} onChange={e => setStudentEmailForm(f => ({...f, subject: e.target.value}))}
                placeholder={t('الموضوع', 'Subject')} className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white rounded-xl"/>
              <textarea value={studentEmailForm.body} onChange={e => setStudentEmailForm(f => ({...f, body: e.target.value}))}
                rows={4} placeholder={t('النص... يمكن استخدام {name}', 'Message... use {name}')}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"/>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStudentEmailModal(null)} className="flex-1 h-11 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">{t('إلغاء', 'Cancel')}</button>
              <Button onClick={sendStudentEmail} disabled={!studentEmailForm.subject || !studentEmailForm.body} className="flex-1 h-11 bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2 rounded-xl shadow-md">
                <Send className="w-4 h-4"/> {t('إرسال', 'Send')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ DELETE CONFIRM ══════════ */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-600 dark:text-red-400"/>
            </div>
            <h3 className="font-black text-xl text-slate-800 dark:text-white text-center mb-1">{t('حذف الدفعة؟', 'Delete Batch?')}</h3>
            <p className="text-sm text-slate-400 text-center mb-4">{t('لا يمكن التراجع عن هذه العملية', 'This action cannot be undone')}</p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-5 text-center">
              <p className="font-black text-red-700 dark:text-red-400">{deleteConfirm.name}</p>
              <p className="text-xs text-red-500 dark:text-red-500/80 mt-1">{deleteConfirm.student_count} {t('طالب مرتبط', 'linked students')}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 h-11 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{t('إلغاء', 'Cancel')}</button>
              <Button onClick={() => deleteBatch(deleteConfirm)} className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-bold gap-2 rounded-xl shadow-md">
                <Trash2 className="w-4 h-4"/> {t('حذف', 'Delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ CSV IMPORT MODAL ══════════ */}
      {csvBatchModalOpen && csvBatchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setCsvBatchModalOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                <Upload className="w-5 h-5 text-teal-600 dark:text-teal-400"/>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-slate-800 dark:text-white">{t('استيراد طلاب', 'Import Students')}</h3>
                <p className="text-xs text-teal-600 dark:text-teal-400 font-bold truncate">{csvBatchTarget.name}</p>
              </div>
              <button onClick={() => setCsvBatchModalOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
            <p className="text-xs text-slate-500 mb-3 font-medium">{t('رقم واحد في كل سطر أو مفصولة بفاصلة', 'One ID per line or comma-separated')}</p>
            <textarea value={csvBatchText}
              onChange={e => { setCsvBatchText(e.target.value); setCsvBatchPreview(parseBatchCSV(e.target.value)); }}
              placeholder={"44600001\n44600002\n44600003"}
              rows={6}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 mb-3" dir="ltr"/>
            {csvBatchPreview.length > 0 && (
              <div className="mb-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-2xl p-4 flex items-center gap-3">
                <Star className="w-5 h-5 text-teal-500 flex-shrink-0"/>
                <div>
                  <p className="text-sm font-black text-teal-700 dark:text-teal-400">{csvBatchPreview.length} {t('رقم جاهز للتعيين', 'IDs ready to assign')}</p>
                  <p className="text-[10px] text-teal-600/70 dark:text-teal-500/70 font-mono mt-0.5 truncate">{csvBatchPreview.slice(0, 5).join(', ')}{csvBatchPreview.length > 5 ? '...' : ''}</p>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setCsvBatchModalOpen(false)} className="flex-1 h-11 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">{t('إلغاء', 'Cancel')}</button>
              <button onClick={importBatchStudentsCSV} disabled={csvBatchPreview.length === 0 || importingBatchCSV}
                className="flex-1 h-11 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold gap-2 flex items-center justify-center transition-colors shadow-md text-sm">
                {importingBatchCSV ? <RefreshCcw className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
                {importingBatchCSV ? t('جاري التعيين...', 'Assigning...') : t(`تعيين ${csvBatchPreview.length}`, `Assign ${csvBatchPreview.length}`)}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminBatches;
