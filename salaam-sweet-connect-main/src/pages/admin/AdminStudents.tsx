import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import {
  Users, Plus, Search, GraduationCap, HardHat, UserCog, ShieldAlert,
  Pencil, Trash2, Ban, CheckCircle, KeyRound, Mail, Send, FileSpreadsheet,
  Upload, AlertTriangle, LayoutGrid, List, ChevronLeft, ChevronRight,
  Phone, X, Filter, ArrowUpDown, BookOpen,
  UserX, UserCheck, Download, RefreshCw, Inbox, Layers, Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast.ts';
import { useLanguage } from '../../LanguageContext.tsx';
import { useAuth } from '@/contexts/AuthContext.tsx';
import { useTheme } from '@/contexts/ThemeContext.tsx';
import { apiUrl } from '@/lib/api';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
interface Batch {
  id: number;
  name: string;
  code: string;
  department?: string;
}

interface User {
  universityId: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  isBanned?: boolean;
  activeLoans?: number;
  batch_id?: number;
}

type FilterRole = 'all' | 'student' | 'engineer' | 'admin' | 'banned';
type ViewMode   = 'table' | 'grid';
type SortCol    = 'name' | 'loans' | 'status' | 'role';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
const roleKey = (role: string) => role.toLowerCase();
const isStudent  = (r: string) => roleKey(r) === 'طالب'  || roleKey(r) === 'student';
const isEngineer = (r: string) => roleKey(r) === 'مهندس' || roleKey(r) === 'engineer';
const isAdmin    = (r: string) => roleKey(r) === 'مشرف'  || roleKey(r) === 'admin';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ──────────────────────────────────────────────────────────────────────────────
// قوالب الإيميل / الواتساب الجاهزة (10 قوالب)
// ──────────────────────────────────────────────────────────────────────────────
const EMAIL_TEMPLATES = [
  {
    id: 1, icon: '👋', label: 'ترحيب بمستخدم جديد',
    subject: 'مرحباً بك في منظومة معمل أكاديمية طويق',
    body: `مرحباً {name}،\n\nيسعدنا الترحيب بك في منظومة إدارة معمل أكاديمية طويق.\nيمكنك تسجيل الدخول باستخدام رقمك الأكاديمي وكلمة المرور المؤقتة.\n\nللاستفسار تواصل مع فريق الدعم.\n\nفريق إدارة المعمل 🎓`,
  },
  {
    id: 2, icon: '📦', label: 'تذكير بإعادة العهدة',
    subject: 'تذكير: موعد إعادة العهدة قادم',
    body: `مرحباً {name}،\n\nهذا تذكير بأن موعد إعادة العهدة المستلمة منكم يقترب.\nنرجو منك المبادرة بإعادة القطع في الموعد المحدد تجنباً لأي غرامات.\n\nشكراً لتعاونك 🙏\nإدارة المعمل`,
  },
  {
    id: 3, icon: '⚠️', label: 'تحذير عهدة متأخرة',
    subject: '⚠️ تنبيه: عهدة متأخرة في حسابك',
    body: `مرحباً {name}،\n\nلاحظنا أن هناك قطعاً متأخرة لم يتم إعادتها حتى الآن.\nنطلب منك التواصل مع إدارة المعمل فوراً لتسوية الوضع وإعادة القطع.\n\nعدم الاستجابة قد يؤثر على صلاحياتك في استعارة قطع مستقبلاً.\n\nإدارة المعمل ⚠️`,
  },
  {
    id: 4, icon: '✅', label: 'تأكيد قبول الطلب',
    subject: '✅ تم قبول طلبك بنجاح',
    body: `مرحباً {name}،\n\nيسعدنا إخبارك بأنه تم قبول طلبك واعتماده من قبل إدارة المعمل.\nيمكنك استلام القطع المطلوبة خلال أوقات الدوام الرسمي.\n\nنتمنى لك تجربة ممتازة 🌟\nإدارة المعمل`,
  },
  {
    id: 5, icon: '❌', label: 'رفض طلب استعارة',
    subject: 'بخصوص طلب الاستعارة المقدم',
    body: `مرحباً {name}،\n\nبعد مراجعة طلب الاستعارة المقدم منك، نأسف لإبلاغك بعدم إمكانية تلبية الطلب في الوقت الحالي.\nالسبب: الكمية غير متوفرة أو الطلب لا يستوفي الشروط المطلوبة.\n\nيمكنك التقدم بطلب جديد أو التواصل معنا للاستفسار.\n\nإدارة المعمل`,
  },
  {
    id: 6, icon: '🔑', label: 'إعادة تعيين كلمة المرور',
    subject: 'تم إعادة تعيين كلمة المرور الخاصة بك',
    body: `مرحباً {name}،\n\nتم إعادة تعيين كلمة المرور الخاصة بك.\nكلمة المرور الجديدة المؤقتة = رقمك الأكاديمي.\n\nيُرجى تغييرها فور تسجيل الدخول للحفاظ على أمان حسابك 🔒\n\nإدارة المعمل`,
  },
  {
    id: 7, icon: '🚫', label: 'إشعار تعليق الحساب',
    subject: '🚫 إشعار: تم تعليق حسابك مؤقتاً',
    body: `مرحباً {name}،\n\nنود إعلامك بأنه تم تعليق حسابك في منظومة معمل أكاديمية طويق مؤقتاً.\nالسبب: مخالفة سياسات الاستخدام أو وجود عهدة متأخرة لم تتم تسويتها.\n\nلإعادة تفعيل حسابك، تواصل مع الإدارة.\n\nإدارة المعمل`,
  },
  {
    id: 8, icon: '🟢', label: 'إعادة تفعيل الحساب',
    subject: '🟢 تم تفعيل حسابك مجدداً',
    body: `مرحباً {name}،\n\nيسعدنا إخبارك بأنه تم رفع التعليق عن حسابك وإعادة تفعيله بالكامل.\nيمكنك الآن تسجيل الدخول واستخدام جميع الخدمات المتاحة.\n\nنتمنى لك تجربة ممتازة ✨\nإدارة المعمل`,
  },
  {
    id: 9, icon: '📢', label: 'إعلان عام للمستخدمين',
    subject: '📢 إعلان هام من إدارة معمل أكاديمية طويق',
    body: `مرحباً {name}،\n\nنود إبلاغكم بإعلان هام:\n\n[أدخل تفاصيل الإعلان هنا]\n\nللاستفسار أو التواصل:\nراجع مشرف المعمل خلال أوقات الدوام الرسمي.\n\nإدارة المعمل 🎓`,
  },
  {
    id: 10, icon: '🎓', label: 'إشعار انتهاء الدفعة',
    subject: 'إشعار: اقتراب انتهاء مدة دفعتك',
    body: `مرحباً {name}،\n\nنود إعلامك بأن مدة دفعتك ستنتهي قريباً.\nيُرجى التأكد من إعادة جميع القطع المستعارة قبل تاريخ الانتهاء.\n\nبعد انتهاء المدة لن تتمكن من الوصول لخدمات الاستعارة.\n\nشكراً لتفهمك 🙏\nإدارة المعمل`,
  },
  {
    id: 11, icon: '📋', label: 'طلب تحديث بيانات',
    subject: 'طلب: تحديث بياناتك الشخصية',
    body: `مرحباً {name}،\n\nنطلب منك مراجعة بياناتك الشخصية في المنظومة والتأكد من صحتها (رقم الجوال، البريد الإلكتروني).\n\nيمكنك ذلك عبر تسجيل الدخول والتوجه لصفحة الملف الشخصي، أو التواصل مع الإدارة مباشرة.\n\nإدارة المعمل`,
  },
  {
    id: 12, icon: '⭐', label: 'شكر وتقدير',
    subject: '⭐ شكر وتقدير على التزامك',
    body: `مرحباً {name}،\n\nنتقدم لك بخالص الشكر والتقدير على التزامك الدائم بسياسات المعمل وحرصك على إعادة القطع في وقتها.\n\nسلوكك المثالي يساهم في تحسين تجربة جميع المستخدمين 🌟\n\nإدارة المعمل`,
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────
const AdminStudents = () => {
  const { lang, t } = useLanguage();
  const { toast }   = useToast();
  const { user: me } = useAuth();
  const { theme }   = useTheme();
  const isRTL       = lang === 'ar';

  // ── data ──────────────────────────────────────────────────────────────────
  const [users,   setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // ── ui state ──────────────────────────────────────────────────────────────
  const [view,        setView]        = useState<ViewMode>('table');
  const [search,      setSearch]      = useState('');
  const [roleFilter,  setRoleFilter]  = useState<FilterRole>('all');
  const [sortCol,     setSortCol]     = useState<SortCol>('name');
  const [sortDir,     setSortDir]     = useState<'asc' | 'desc'>('asc');
  const [page,        setPage]        = useState(1);
  const PAGE_SIZE = 10;

  // ── selection ─────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── detail panel ──────────────────────────────────────────────────────────
  const [detailUser, setDetailUser] = useState<User | null>(null);

  // ── batches ───────────────────────────────────────────────────────────────
  const [batches, setBatches] = useState<Batch[]>([]);

  // ── add / edit dialog ─────────────────────────────────────────────────────
  const [formOpen,   setFormOpen]   = useState(false);
  const [editMode,   setEditMode]   = useState(false);
  const [form,       setForm]       = useState({ universityId: '', name: '', phone: '', email: '', role: 'طالب', batch_id: '' });
  const [saving,     setSaving]     = useState(false);

  // ── delete confirm ────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // ── email modal ───────────────────────────────────────────────────────────
  const [emailOpen,      setEmailOpen]     = useState(false);
  const [emailUser,      setEmailUser]     = useState<User | null>(null);   // null = bulk mode
  const [emailSubject,   setEmailSubject]  = useState('');
  const [emailBody,      setEmailBody]     = useState('');
  const [sendingEmail,   setSendingEmail]  = useState(false);
  const [showTemplates,  setShowTemplates] = useState(false);
  const emailIsBulk = emailUser === null;

  // ── CSV import ────────────────────────────────────────────────────────────
  const [csvOpen,    setCsvOpen]    = useState(false);
  const [csvText,    setCsvText]    = useState('');
  const [csvRows,    setCsvRows]    = useState<{universityId:string;name:string;phone:string;email:string;role:string}[]>([]);
  const [importing,  setImporting]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── bulk actions overlay ───────────────────────────────────────────────────
  const [bulkBanning, setBulkBanning] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // Audit headers
  // ──────────────────────────────────────────────────────────────────────────
  const ah = useMemo(() => ({
    'Content-Type': 'application/json',
    'admin-id':   me?.id   || '',
    'admin-name': encodeURIComponent(me?.name || ''),
  }), [me]);

  // ──────────────────────────────────────────────────────────────────────────
  // Fetch
  // ──────────────────────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/users'));
      const d   = await res.json();
      if (res.ok) setUsers(d.data);
    } catch {
      toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetch(apiUrl('/api/batches/active'))
      .then(r => r.json())
      .then(d => { if (d.status === 'success') setBatches(d.data); })
      .catch(() => {});
  }, []);
  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, roleFilter]);

  // ──────────────────────────────────────────────────────────────────────────
  // Derived lists
  // ──────────────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u => {
      const matchSearch =
        u.name.toLowerCase().includes(q) ||
        u.universityId.toLowerCase().includes(q) ||
        (u.phone || '').includes(q) ||
        (u.email || '').toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (roleFilter === 'student')  return isStudent(u.role);
      if (roleFilter === 'engineer') return isEngineer(u.role);
      if (roleFilter === 'admin')    return isAdmin(u.role);
      if (roleFilter === 'banned')   return !!u.isBanned;
      return true;
    }).sort((a, b) => {
      const m = sortDir === 'asc' ? 1 : -1;
      if (sortCol === 'loans')  return ((a.activeLoans||0) - (b.activeLoans||0)) * m;
      if (sortCol === 'status') return ((a.isBanned ? 1 : 0) - (b.isBanned ? 1 : 0)) * m;
      if (sortCol === 'role')   return a.role.localeCompare(b.role, 'ar') * m;
      return a.name.localeCompare(b.name, 'ar') * m;
    });
  }, [users, search, roleFilter, sortCol, sortDir]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData    = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allSelected = pageData.length > 0 && pageData.every(u => selected.has(u.universityId));

  const stats = useMemo(() => ({
    total:    users.length,
    students: users.filter(u => isStudent(u.role)).length,
    engineers:users.filter(u => isEngineer(u.role)).length,
    admins:   users.filter(u => isAdmin(u.role)).length,
    banned:   users.filter(u => u.isBanned).length,
  }), [users]);

  // ──────────────────────────────────────────────────────────────────────────
  // Sort toggle
  // ──────────────────────────────────────────────────────────────────────────
  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Selection helpers
  // ──────────────────────────────────────────────────────────────────────────
  const toggleOne = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const togglePage = () =>
    setSelected(prev => {
      const s = new Set(prev);
      if (allSelected) pageData.forEach(u => s.delete(u.universityId));
      else              pageData.forEach(u => s.add(u.universityId));
      return s;
    });

  // ──────────────────────────────────────────────────────────────────────────
  // CRUD actions
  // ──────────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.universityId.trim() || !form.name.trim()) return;
    setSaving(true);
    try {
      // 1) إنشاء / تعديل المستخدم الأساسي
      const url    = editMode ? apiUrl(`/api/users/${form.universityId}`) : apiUrl('/api/users');
      const method = editMode ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method, headers: ah,
        body: JSON.stringify({ ...form, password: form.universityId }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast({ title: t('تنبيه', 'Warning'), description: d.message, variant: 'destructive' });
        return;
      }

      // 2) إذا اختار الأدمن دفعة → عيّن المستخدم فيها (يولّد الرقم الأكاديمي تلقائياً)
      if (form.batch_id) {
        const assignRes = await fetch(apiUrl(`/api/admin/batches/${form.batch_id}/assign-student`), {
          method: 'POST', headers: ah,
          body: JSON.stringify({ universityId: form.universityId }),
        });
        const assignData = await assignRes.json();
        if (assignRes.ok) {
          toast({
            title: editMode ? t('تم التعديل ✅', 'Updated ✅') : t('تمت الإضافة ✅', 'Added ✅'),
            description: t(`الرقم الأكاديمي: ${assignData.universityId}`, `Academic ID: ${assignData.universityId}`),
          });
        } else {
          toast({ title: t('تحذير الدفعة', 'Batch warning'), description: assignData.message, variant: 'destructive' });
        }
      } else {
        toast({ title: editMode ? t('تم التعديل ✅', 'Updated ✅') : t('تمت الإضافة ✅', 'Added ✅') });
      }

      setFormOpen(false);
      fetchUsers();
      if (editMode && detailUser?.universityId === form.universityId)
        setDetailUser(prev => prev ? { ...prev, name: form.name, phone: form.phone, email: form.email, role: form.role } : null);
    } catch {
      toast({ title: t('خطأ', 'Error'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/users/${deleteTarget.universityId}`), {
        method: 'DELETE',
        headers: { 'admin-id': me?.id || '', 'admin-name': encodeURIComponent(me?.name || '') },
      });
      if (res.ok) {
        toast({ title: t('تم الحذف 🗑️', 'Deleted 🗑️') });
        if (detailUser?.universityId === deleteTarget.universityId) setDetailUser(null);
        fetchUsers();
      } else {
        toast({ title: t('لا يمكن الحذف', 'Cannot delete'), description: t('قد يكون للمستخدم عهد نشطة', 'User may have active loans'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ', 'Error'), variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const toggleBan = async (u: User) => {
    const newBan = !u.isBanned;
    try {
      const res = await fetch(apiUrl(`/api/users/${u.universityId}/status`), {
        method: 'PUT', headers: ah, body: JSON.stringify({ isBanned: newBan }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(x => x.universityId === u.universityId ? { ...x, isBanned: newBan } : x));
        if (detailUser?.universityId === u.universityId) setDetailUser(p => p ? { ...p, isBanned: newBan } : null);
        toast({ title: newBan ? t('تم حظر المستخدم 🚫', 'User banned 🚫') : t('تم رفع الحظر ✅', 'Ban lifted ✅') });
      }
    } catch { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const resetPassword = async (u: User) => {
    try {
      const res = await fetch(apiUrl(`/api/users/${u.universityId}/reset-password`), { method: 'PUT', headers: ah });
      if (res.ok) toast({ title: t('تم إعادة الضبط 🔑', 'Password Reset 🔑'), description: t(`كلمة المرور الجديدة: ${u.universityId}`, `New password: ${u.universityId}`) });
    } catch { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const sendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    setSendingEmail(true);
    try {
      const targets: User[] = emailIsBulk
        ? users.filter(u => selected.has(u.universityId) && u.email)
        : emailUser && emailUser.email ? [emailUser] : [];

      for (const u of targets) {
        await fetch(apiUrl('/api/admin/send-custom-email'), {
          method: 'POST', headers: ah,
          body: JSON.stringify({ to: u.email, subject: emailSubject, body: emailBody.replace('{name}', u.name) }),
        }).catch(() => {});
      }
      toast({ title: t(`تم الإرسال لـ ${targets.length} مستخدم`, `Sent to ${targets.length} user(s)`) });
      setEmailOpen(false); setEmailSubject(''); setEmailBody('');
      if (emailIsBulk) setSelected(new Set());
    } catch {
      toast({ title: t('خطأ', 'Error'), variant: 'destructive' });
    } finally { setSendingEmail(false); }
  };

  const bulkBan = async (ban: boolean) => {
    setBulkBanning(true);
    for (const id of Array.from(selected)) {
      await fetch(apiUrl(`/api/users/${id}/status`), { method: 'PUT', headers: ah, body: JSON.stringify({ isBanned: ban }) }).catch(() => {});
    }
    toast({ title: ban ? t(`تم حظر ${selected.size} مستخدم`, `Banned ${selected.size} users`) : t(`تم رفع الحظر عن ${selected.size}`, `Unbanned ${selected.size}`) });
    setSelected(new Set());
    fetchUsers();
    setBulkBanning(false);
  };

  // ── CSV import ────────────────────────────────────────────────────────────
  const parseCSV = (text: string) => {
    const rows = text.trim().split('\n').filter(l => l.trim()).map(line => {
      const [universityId='', name='', phone='', email='', role='طالب'] = line.split(',').map(p => p.trim());
      return { universityId, name, phone, email, role };
    }).filter(r => r.universityId && r.name);
    setCsvRows(rows);
  };

  const importCSV = async () => {
    if (!csvRows.length) return;
    setImporting(true);
    let ok = 0;
    for (const r of csvRows) {
      try {
        const res = await fetch(apiUrl('/api/users'), { method: 'POST', headers: ah, body: JSON.stringify({ ...r, password: r.universityId }) });
        if (res.ok) ok++;
      } catch { /* continue */ }
    }
    toast({ title: t(`تم إضافة ${ok} من ${csvRows.length}`, `Added ${ok}/${csvRows.length} users`) });
    setImporting(false); setCsvOpen(false); setCsvText(''); setCsvRows([]); fetchUsers();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { const text = ev.target?.result as string; setCsvText(text); parseCSV(text); };
    reader.readAsText(file, 'UTF-8');
  };

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const hdr = ['الرقم الأكاديمي', 'الاسم', 'الدور', 'رقم الجوال', 'البريد', 'العهد النشطة', 'الحالة'];
    const rows = filtered.map(u => [u.universityId, u.name, u.role, u.phone||'', u.email||'', u.activeLoans||0, u.isBanned?'محظور':'نشط']);
    const csv = '\uFEFF' + [hdr, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast({ title: t('تم التصدير ✅', 'Exported ✅') });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Sub-components
  // ──────────────────────────────────────────────────────────────────────────

  // Avatar
  const Avatar = ({ user: u, size = 'md' }: { user: User; size?: 'sm'|'md'|'lg' }) => {
    const sz   = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm';
    const ring = u.isBanned ? 'ring-2 ring-red-400' : '';
    let bg = 'bg-slate-500';
    if (isStudent(u.role))  bg = 'bg-emerald-500';
    if (isEngineer(u.role)) bg = 'bg-blue-500';
    if (isAdmin(u.role))    bg = 'bg-purple-500';
    if (u.isBanned)         bg = 'bg-slate-400';
    return (
      <div className={`${sz} ${bg} ${ring} rounded-full flex items-center justify-center text-white font-black shrink-0 select-none`}>
        {initials(u.name)}
      </div>
    );
  };

  // Role badge
  const RoleBadge = ({ role }: { role: string }) => {
    let cls = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    let label = role;
    if (isStudent(role))  { cls = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'; label = t('طالب','Student'); }
    if (isEngineer(role)) { cls = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'; label = t('مهندس','Engineer'); }
    if (isAdmin(role))    { cls = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800'; label = t('مشرف','Admin'); }
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${cls}`}>{label}</span>;
  };

  // Status badge
  const StatusBadge = ({ banned }: { banned?: boolean }) =>
    banned
      ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900"><UserX className="w-3 h-3"/>{t('محظور','Banned')}</span>
      : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900"><UserCheck className="w-3 h-3"/>{t('نشط','Active')}</span>;

  // Sort indicator
  const SortBtn = ({ col, label }: { col: SortCol; label: string }) => (
    <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group">
      {label}
      <ArrowUpDown className={`w-3 h-3 transition-opacity ${sortCol === col ? 'opacity-100 text-blue-500' : 'opacity-30 group-hover:opacity-60'}`}/>
    </button>
  );

  // Skeleton row
  const SkeletonRow = () => (
    <tr className="border-b border-slate-100 dark:border-slate-800 animate-pulse">
      {[40,200,90,80,70,120].map((w,i) => (
        <td key={i} className="px-4 py-3"><div className={`h-4 bg-slate-200 dark:bg-slate-700 rounded`} style={{width:w}}/></td>
      ))}
    </tr>
  );

  // Quick action button
  const QABtn = ({ icon: Icon, label, onClick, color='text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200' }: {
    icon: React.ElementType; label: string; onClick: () => void; color?: string;
  }) => (
    <button title={label} onClick={e => { e.stopPropagation(); onClick(); }}
      className={`p-1.5 rounded-lg transition-colors ${color}`}>
      <Icon className="w-3.5 h-3.5"/>
    </button>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 font-sans pb-24 transition-colors" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ═══════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
              <Users className="w-5 h-5 text-white"/>
            </div>
            {t('إدارة المستخدمين', 'User Management')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {loading ? '...' : t(`${stats.total} مستخدم مسجل`, `${stats.total} registered users`)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={exportCSV} variant="outline" size="sm"
            className="gap-2 font-bold text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 h-9">
            <Download className="w-4 h-4 text-emerald-600"/>
            {t('تصدير', 'Export')}
          </Button>
          <Button onClick={() => { setCsvText(''); setCsvRows([]); setCsvOpen(true); }} variant="outline" size="sm"
            className="gap-2 font-bold text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 h-9">
            <Upload className="w-4 h-4"/>
            {t('استيراد CSV', 'Import CSV')}
          </Button>
          <Button onClick={() => { setEditMode(false); setForm({ universityId:'', name:'', phone:'', email:'', role:'طالب', batch_id:'' }); setFormOpen(true); }}
            size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md h-9 transition-transform active:scale-95">
            <Plus className="w-4 h-4"/>
            {t('مستخدم جديد', 'New User')}
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          STATS CARDS
      ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { key:'all',      icon:Users,       label:t('الكل','All'),          count:stats.total,     c:'blue',   border:'border-l-blue-500',   bg:'bg-blue-50 dark:bg-blue-900/20',    text:'text-blue-600 dark:text-blue-400' },
          { key:'student',  icon:GraduationCap, label:t('الطلاب','Students'),  count:stats.students,  c:'emerald',border:'border-l-emerald-500',bg:'bg-emerald-50 dark:bg-emerald-900/20', text:'text-emerald-600 dark:text-emerald-400' },
          { key:'engineer', icon:HardHat,     label:t('المهندسون','Engineers'),count:stats.engineers, c:'sky',    border:'border-l-sky-500',    bg:'bg-sky-50 dark:bg-sky-900/20',       text:'text-sky-600 dark:text-sky-400' },
          { key:'admin',    icon:UserCog,     label:t('المشرفون','Admins'),    count:stats.admins,    c:'purple', border:'border-l-purple-500', bg:'bg-purple-50 dark:bg-purple-900/20', text:'text-purple-600 dark:text-purple-400' },
          { key:'banned',   icon:ShieldAlert, label:t('محظورون','Banned'),     count:stats.banned,    c:'red',    border:'border-l-red-500',    bg:'bg-red-50 dark:bg-red-900/20',       text:'text-red-600 dark:text-red-400' },
        ].map(({ key, icon: Icon, label, count, border, bg, text }) => (
          <button key={key}
            onClick={() => setRoleFilter(prev => prev === key as FilterRole ? 'all' : key as FilterRole)}
            className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 border-l-4 rtl:border-l-0 rtl:border-r-4 ${border} transition-all hover:-translate-y-0.5 hover:shadow-md text-start w-full ${roleFilter===key?'ring-2 ring-offset-1 ring-blue-400 dark:ring-blue-700':''}`}>
            <div className={`${bg} p-2.5 rounded-xl ${text} shrink-0`}><Icon className="w-5 h-5"/></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">{label}</p>
              <p className={`text-2xl font-black leading-none ${text}`}>{loading ? '—' : count}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
          SEARCH + FILTERS BAR
      ═══════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
        <div className="flex gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className={`absolute ${isRTL?'right-3':'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`}/>
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('البحث بالاسم، الرقم، الجوال، أو البريد...','Search by name, ID, phone, or email...')}
              className={`${isRTL?'pr-10':'pl-10'} h-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white text-sm rounded-xl`}
            />
            {search && (
              <button onClick={() => setSearch('')} className={`absolute ${isRTL?'left-3':'right-3'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600`}>
                <X className="w-4 h-4"/>
              </button>
            )}
          </div>
          {/* View toggle */}
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0">
            <button onClick={() => setView('table')}
              className={`px-3 py-2 transition-colors ${view==='table'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              <List className="w-4 h-4"/>
            </button>
            <button onClick={() => setView('grid')}
              className={`px-3 py-2 transition-colors ${view==='grid'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              <LayoutGrid className="w-4 h-4"/>
            </button>
          </div>
          {/* Refresh */}
          <button onClick={fetchUsers} title={t('تحديث','Refresh')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 ml-1"><Filter className="w-3 h-3"/>{t('تصفية:','Filter:')}</span>
          {[
            {k:'all', l:t('الكل','All')},
            {k:'student', l:t('طلاب','Students')},
            {k:'engineer', l:t('مهندسون','Engineers')},
            {k:'admin', l:t('مشرفون','Admins')},
            {k:'banned', l:t('محظورون','Banned')},
          ].map(({k,l}) => (
            <button key={k} onClick={() => setRoleFilter(k as FilterRole)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors border ${
                roleFilter===k
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
              }`}>
              {l}
            </button>
          ))}
          {(search || roleFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setRoleFilter('all'); }}
              className="px-3 py-1 rounded-full text-xs font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1">
              <X className="w-3 h-3"/>{t('مسح الفلاتر','Clear filters')}
            </button>
          )}
          <span className="mr-auto text-xs text-slate-400 dark:text-slate-500 font-medium">
            {t(`${filtered.length} نتيجة`, `${filtered.length} result(s)`)}
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          TABLE VIEW
      ═══════════════════════════════════════════════════════ */}
      {view === 'table' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wide">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={togglePage}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 accent-blue-600 cursor-pointer"/>
                  </th>
                  <th className="px-4 py-3 text-start"><SortBtn col="name" label={t('المستخدم','User')}/></th>
                  <th className="px-4 py-3 text-start"><SortBtn col="role" label={t('الدور','Role')}/></th>
                  <th className="px-4 py-3 text-center"><SortBtn col="loans" label={t('عهد','Loans')}/></th>
                  <th className="px-4 py-3 text-start"><SortBtn col="status" label={t('الحالة','Status')}/></th>
                  <th className="px-4 py-3 text-center">{t('إجراءات','Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  Array.from({length:6}).map((_,i) => <SkeletonRow key={i}/>)
                ) : pageData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
                        <Inbox className="w-12 h-12 opacity-30"/>
                        <p className="font-bold text-base">{t('لا توجد نتائج','No results found')}</p>
                        <p className="text-sm">{t('جرب تعديل الفلاتر أو البحث','Try adjusting your filters or search')}</p>
                      </div>
                    </td>
                  </tr>
                ) : pageData.map(u => (
                  <tr key={u.universityId}
                    onClick={() => setDetailUser(u)}
                    className={`transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                      selected.has(u.universityId) ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    } ${detailUser?.universityId === u.universityId ? 'bg-blue-50/70 dark:bg-blue-900/15' : ''}`}>
                    <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleOne(u.universityId); }}>
                      <input type="checkbox" checked={selected.has(u.universityId)} onChange={() => toggleOne(u.universityId)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 accent-blue-600 cursor-pointer"/>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={u}/>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white leading-tight">{u.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{u.universityId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={u.role}/></td>
                    <td className="px-4 py-3 text-center">
                      {(u.activeLoans || 0) > 0
                        ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900">
                            <BookOpen className="w-3 h-3"/>{u.activeLoans}
                          </span>
                        : <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3"><StatusBadge banned={u.isBanned}/></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-0.5" onClick={e => e.stopPropagation()}>
                        <QABtn icon={Pencil}     label={t('تعديل','Edit')}
                          onClick={() => { setEditMode(true); setForm({ universityId:u.universityId, name:u.name, phone:u.phone||'', email:u.email||'', role:u.role, batch_id: u.batch_id ? String(u.batch_id) : '' }); setFormOpen(true); }}/>
                        <QABtn icon={KeyRound}   label={t('إعادة ضبط كلمة المرور','Reset Password')}
                          color="text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400"
                          onClick={() => resetPassword(u)}/>
                        {u.email && (
                          <QABtn icon={Mail}     label={t('إرسال بريد','Send Email')}
                            color="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400"
                            onClick={() => { setEmailUser(u); setEmailSubject(''); setEmailBody(''); setEmailOpen(true); }}/>
                        )}
                        <QABtn icon={u.isBanned ? CheckCircle : Ban}
                          label={u.isBanned ? t('رفع الحظر','Unban') : t('حظر','Ban')}
                          color={u.isBanned
                            ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400'
                            : 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:hover:text-orange-400'}
                          onClick={() => toggleBan(u)}/>
                        <QABtn icon={Trash2}     label={t('حذف','Delete')}
                          color="text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
                          onClick={() => setDeleteTarget(u)}/>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap bg-slate-50/60 dark:bg-slate-950/40">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(`عرض ${Math.min((page-1)*PAGE_SIZE+1, filtered.length)}–${Math.min(page*PAGE_SIZE, filtered.length)} من ${filtered.length}`,
                   `Showing ${Math.min((page-1)*PAGE_SIZE+1, filtered.length)}–${Math.min(page*PAGE_SIZE, filtered.length)} of ${filtered.length}`)}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page===1}
                  className="px-2 py-1 rounded text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 font-bold">
                  {isRTL ? '»' : '«'}
                </button>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                  className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30">
                  <ChevronRight className={`w-4 h-4 ${isRTL?'':'rotate-180'}`}/>
                </button>
                {Array.from({length: Math.min(5, totalPages)}, (_,i) => {
                  const start = Math.max(1, Math.min(page-2, totalPages-4));
                  const p = start + i;
                  return p <= totalPages ? (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded text-xs font-bold transition-colors ${p===page ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                      {p}
                    </button>
                  ) : null;
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                  className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30">
                  <ChevronLeft className={`w-4 h-4 ${isRTL?'':'rotate-180'}`}/>
                </button>
                <button onClick={() => setPage(totalPages)} disabled={page===totalPages}
                  className="px-2 py-1 rounded text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 font-bold">
                  {isRTL ? '«' : '»'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          GRID VIEW
      ═══════════════════════════════════════════════════════ */}
      {view === 'grid' && (
        <div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({length:8}).map((_,i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 animate-pulse space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full"/>
                    <div className="space-y-2 flex-1"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"/><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"/></div>
                  </div>
                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-xl"/>
                </div>
              ))}
            </div>
          ) : pageData.length === 0 ? (
            <div className="py-20 text-center text-slate-400 dark:text-slate-500">
              <Inbox className="w-12 h-12 mx-auto opacity-30 mb-3"/>
              <p className="font-bold text-base">{t('لا توجد نتائج','No results found')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {pageData.map(u => (
                <div key={u.universityId}
                  onClick={() => setDetailUser(u)}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md flex flex-col overflow-hidden ${
                    selected.has(u.universityId) ? 'border-blue-400 dark:border-blue-600 ring-2 ring-blue-400/30' : 'border-slate-200 dark:border-slate-800'
                  } ${u.isBanned ? 'opacity-70' : ''}`}>
                  {/* Card top strip by role */}
                  <div className={`h-1.5 w-full ${isStudent(u.role)?'bg-emerald-500':isEngineer(u.role)?'bg-blue-500':isAdmin(u.role)?'bg-purple-500':'bg-slate-400'}`}/>
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Avatar user={u} size="md"/>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white text-sm leading-snug">{u.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{u.universityId}</p>
                        </div>
                      </div>
                      <input type="checkbox" checked={selected.has(u.universityId)}
                        onChange={e => { e.stopPropagation(); toggleOne(u.universityId); }}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 accent-blue-600 cursor-pointer mt-0.5 shrink-0"/>
                    </div>
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <RoleBadge role={u.role}/>
                      <StatusBadge banned={u.isBanned}/>
                      {(u.activeLoans||0) > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900">
                          <BookOpen className="w-3 h-3"/>{u.activeLoans}
                        </span>
                      )}
                    </div>
                    {/* Contact */}
                    {(u.phone || u.email) && (
                      <div className="space-y-1 border-t border-slate-100 dark:border-slate-800 pt-2">
                        {u.phone && <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono"><Phone className="w-3 h-3 shrink-0"/>{u.phone}</p>}
                        {u.email && <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 shrink-0"/>{u.email}</p>}
                      </div>
                    )}
                  </div>
                  {/* Actions footer */}
                  <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
                    <QABtn icon={Pencil} label={t('تعديل','Edit')}
                      onClick={() => { setEditMode(true); setForm({ universityId:u.universityId, name:u.name, phone:u.phone||'', email:u.email||'', role:u.role, batch_id: u.batch_id ? String(u.batch_id) : '' }); setFormOpen(true); }}/>
                    <QABtn icon={KeyRound} label={t('إعادة ضبط','Reset')}
                      color="text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      onClick={() => resetPassword(u)}/>
                    {u.email && <QABtn icon={Mail} label={t('إيميل','Email')}
                      color="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      onClick={() => { setEmailUser(u); setEmailSubject(''); setEmailBody(''); setEmailOpen(true); }}/>}
                    <QABtn icon={u.isBanned ? CheckCircle : Ban}
                      label={u.isBanned ? t('رفع الحظر','Unban') : t('حظر','Ban')}
                      color={u.isBanned ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'}
                      onClick={() => toggleBan(u)}/>
                    <QABtn icon={Trash2} label={t('حذف','Delete')}
                      color="text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => setDeleteTarget(u)}/>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Pagination (grid) */}
          {!loading && filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <ChevronRight className={`w-4 h-4 ${isRTL?'':'rotate-180'}`}/>{t('السابق','Prev')}
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
                className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                {t('التالي','Next')}<ChevronLeft className={`w-4 h-4 ${isRTL?'':'rotate-180'}`}/>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          BULK ACTION BAR (floating)
      ═══════════════════════════════════════════════════════ */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl shadow-2xl border border-slate-700 dark:border-slate-600 px-4 py-3 flex flex-wrap items-center gap-3 w-full sm:min-w-[340px] sm:w-auto">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-black">{selected.size}</div>
              <span className="text-sm font-bold text-slate-200">{t(`مستخدم محدد`, `selected`)}</span>
            </div>
            <div className="h-6 w-px bg-slate-700 dark:bg-slate-600"/>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEmailUser(null); setEmailSubject(''); setEmailBody(''); setEmailOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors">
                <Mail className="w-3.5 h-3.5"/>{t('إيميل جماعي','Bulk Email')}
              </button>
              <button onClick={() => bulkBan(true)} disabled={bulkBanning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-colors disabled:opacity-50">
                <Ban className="w-3.5 h-3.5"/>{t('حظر الكل','Ban All')}
              </button>
              <button onClick={() => bulkBan(false)} disabled={bulkBanning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-50">
                <CheckCircle className="w-3.5 h-3.5"/>{t('رفع الحظر','Unban')}
              </button>
            </div>
            <button onClick={() => setSelected(new Set())} className="mr-auto text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4"/>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          USER DETAIL PANEL (slide-in from side)
      ═══════════════════════════════════════════════════════ */}
      {detailUser && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 backdrop-blur-sm" onClick={() => setDetailUser(null)}/>
          {/* Panel */}
          <div className={`fixed top-0 ${isRTL?'left-0':'right-0'} h-full w-full sm:w-96 bg-white dark:bg-slate-900 z-50 shadow-2xl border-${isRTL?'r':'l'} border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right-full duration-300`}>
            {/* Panel header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center gap-3">
              <button onClick={() => setDetailUser(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5"/>
              </button>
              <h3 className="font-black text-slate-800 dark:text-white text-base">{t('تفاصيل المستخدم','User Details')}</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Avatar + name */}
              <div className="flex flex-col items-center text-center gap-3 py-2">
                <Avatar user={detailUser} size="lg"/>
                <div>
                  <p className="font-black text-xl text-slate-800 dark:text-white">{detailUser.name}</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 font-mono mt-0.5">{detailUser.universityId}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <RoleBadge role={detailUser.role}/>
                  <StatusBadge banned={detailUser.isBanned}/>
                  {(detailUser.activeLoans||0) > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900">
                      <BookOpen className="w-3 h-3"/>{detailUser.activeLoans} {t('عهدة نشطة','active loans')}
                    </span>
                  )}
                </div>
              </div>

              {/* Info grid */}
              <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {[
                  { icon: BookOpen, label: t('الرقم الأكاديمي','Academic ID'), value: detailUser.universityId },
                  { icon: Phone,    label: t('رقم الجوال','Phone'),             value: detailUser.phone || t('غير محدد','N/A') },
                  { icon: Mail,     label: t('البريد الإلكتروني','Email'),      value: detailUser.email || t('غير محدد','N/A') },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 px-4 py-3">
                    <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0"/>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{label}</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="gap-2 h-10 font-bold border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={() => { setEditMode(true); setForm({ universityId:detailUser.universityId, name:detailUser.name, phone:detailUser.phone||'', email:detailUser.email||'', role:detailUser.role, batch_id: detailUser.batch_id ? String(detailUser.batch_id) : '' }); setFormOpen(true); }}>
                  <Pencil className="w-4 h-4"/>{t('تعديل','Edit')}
                </Button>
                <Button variant="outline" size="sm" className="gap-2 h-10 font-bold border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  onClick={() => resetPassword(detailUser)}>
                  <KeyRound className="w-4 h-4"/>{t('إعادة ضبط','Reset PW')}
                </Button>
                {detailUser.email && (
                  <Button variant="outline" size="sm" className="gap-2 h-10 font-bold border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    onClick={() => { setEmailUser(detailUser); setEmailSubject(''); setEmailBody(''); setEmailOpen(true); }}>
                    <Mail className="w-4 h-4"/>{t('إرسال إيميل','Send Email')}
                  </Button>
                )}
                <Button variant="outline" size="sm"
                  className={`gap-2 h-10 font-bold ${detailUser.isBanned ? 'border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'border-orange-200 dark:border-orange-900 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
                  onClick={() => toggleBan(detailUser)}>
                  {detailUser.isBanned ? <><CheckCircle className="w-4 h-4"/>{t('رفع الحظر','Unban')}</> : <><Ban className="w-4 h-4"/>{t('حظر','Ban')}</>}
                </Button>
                <Button variant="outline" size="sm" className="gap-2 h-10 font-bold border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 col-span-2"
                  onClick={() => setDeleteTarget(detailUser)}>
                  <Trash2 className="w-4 h-4"/>{t('حذف الحساب','Delete Account')}
                </Button>
              </div>

              {/* WhatsApp link */}
              {detailUser.phone && (
                <a href={`https://wa.me/966${detailUser.phone.replace(/\D/g,'').replace(/^0/,'')}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors shadow-sm">
                  <Phone className="w-4 h-4"/>
                  {t('فتح واتساب','Open WhatsApp')}
                </a>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          ADD / EDIT USER DIALOG
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="font-black text-lg flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${editMode ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                {editMode ? <Pencil className="w-4 h-4 text-amber-600 dark:text-amber-400"/> : <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400"/>}
              </div>
              {editMode ? t('تعديل بيانات المستخدم','Edit User') : t('إضافة مستخدم جديد','Add New User')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-1 py-2">
            <div className="grid grid-cols-2 gap-3">

              {/* الرقم الأكاديمي — حقل واحد فقط */}
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t('الرقم الأكاديمي *','Academic ID *')}
                  {!editMode && form.batch_id && (
                    <span className="text-emerald-500 font-normal mr-2 text-[10px]">
                      {t('سيُولَّد تلقائياً من الدفعة','Will be auto-generated from batch')}
                    </span>
                  )}
                </Label>
                <Input
                  value={form.universityId}
                  onChange={e => setForm(p => ({...p, universityId: e.target.value}))}
                  disabled={editMode || (!editMode && !!form.batch_id)}
                  placeholder={form.batch_id ? t('تلقائي من الدفعة','Auto from batch') : '441001'}
                  dir="ltr"
                  className="font-mono dark:bg-slate-950 dark:border-slate-700 dark:text-white disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800"/>
              </div>

              {/* الاسم */}
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('الاسم الكامل *','Full Name *')}</Label>
                <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                  placeholder={t('أحمد محمد الغامدي','Ahmad Al-Ghamdi')}
                  className="dark:bg-slate-950 dark:border-slate-700 dark:text-white"/>
              </div>

              {/* الجوال */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('رقم الجوال','Phone')}</Label>
                <Input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))}
                  placeholder="05xxxxxxxx" dir="ltr"
                  className="font-mono dark:bg-slate-950 dark:border-slate-700 dark:text-white"/>
              </div>

              {/* الصلاحية */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('الصلاحية','Role')}</Label>
                <Select value={form.role} onValueChange={v => setForm(p => ({...p, role: v}))}>
                  <SelectTrigger className="dark:bg-slate-950 dark:border-slate-700 dark:text-white">
                    <SelectValue/>
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-700">
                    <SelectItem value="طالب"><div className="flex items-center gap-2"><GraduationCap className="w-3.5 h-3.5 text-emerald-500"/>{t('طالب','Student')}</div></SelectItem>
                    <SelectItem value="مهندس"><div className="flex items-center gap-2"><HardHat className="w-3.5 h-3.5 text-blue-500"/>{t('مهندس','Engineer')}</div></SelectItem>
                    <SelectItem value="مشرف"><div className="flex items-center gap-2"><UserCog className="w-3.5 h-3.5 text-purple-500"/>{t('مشرف','Admin')}</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* البريد */}
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('البريد الإلكتروني','Email')}</Label>
                <Input value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                  placeholder="user@example.com" type="email" dir="ltr"
                  className="font-mono dark:bg-slate-950 dark:border-slate-700 dark:text-white"/>
              </div>

              {/* الدفعة — اختيارية، تولّد الرقم الأكاديمي تلقائياً */}
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-500"/>
                  {t('الدفعة (اختياري)','Batch (optional)')}
                  {form.batch_id && <span className="text-emerald-500 text-[10px] font-normal">{t('← سيُولَّد الرقم الأكاديمي تلقائياً','← Academic ID will be auto-generated')}</span>}
                </Label>
                <Select value={form.batch_id || 'none'} onValueChange={v => {
                  const newBatch = v === 'none' ? '' : v;
                  setForm(p => ({ ...p, batch_id: newBatch, universityId: newBatch ? '' : p.universityId }));
                }}>
                  <SelectTrigger className="dark:bg-slate-950 dark:border-slate-700 dark:text-white">
                    <SelectValue placeholder={t('بدون دفعة','No batch')}/>
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-700">
                    <SelectItem value="none"><span className="text-slate-400">{t('بدون دفعة','No batch')}</span></SelectItem>
                    {batches.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-blue-500"/>
                          <span className="font-bold">{b.name}</span>
                          <span className="text-xs text-slate-400 font-mono">({b.code})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <KeyRound className="w-3.5 h-3.5 shrink-0 text-amber-500"/>
              {form.batch_id
                ? t('الرقم الأكاديمي + كلمة المرور سيُولَّدان تلقائياً من الدفعة','Academic ID & password will be auto-generated from the batch')
                : t('كلمة المرور الافتراضية = الرقم الأكاديمي المُدخل','Default password = the entered academic ID')}
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} className="dark:border-slate-700 dark:text-slate-300">{t('إلغاء','Cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !form.universityId.trim() || !form.name.trim()}
              className={`font-bold gap-2 ${editMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white disabled:opacity-60`}>
              {saving ? <RefreshCw className="w-4 h-4 animate-spin"/> : editMode ? <Pencil className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
              {saving ? t('جاري الحفظ...','Saving...') : editMode ? t('حفظ التعديلات','Save Changes') : t('إضافة المستخدم','Add User')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          DELETE CONFIRM DIALOG
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="font-black text-lg flex items-center gap-2 text-red-600 dark:text-red-400">
              <div className="w-9 h-9 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5"/>
              </div>
              {t('تأكيد الحذف','Confirm Delete')}
            </DialogTitle>
          </DialogHeader>
          <div className="px-1 py-2 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('سيتم حذف حساب','The account of')} <strong className="text-slate-800 dark:text-white">{deleteTarget?.name}</strong> {t('نهائياً ولا يمكن التراجع عن هذا الإجراء.','will be permanently deleted. This action cannot be undone.')}
            </p>
            {deleteTarget && (
              <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-xl p-3">
                <Avatar user={deleteTarget} size="sm"/>
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-white">{deleteTarget.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{deleteTarget.universityId}</p>
                </div>
              </div>
            )}
            {(deleteTarget?.activeLoans || 0) > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 text-xs font-bold px-3 py-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0"/>
                {t(`تحذير: لديه ${deleteTarget?.activeLoans} عهدة نشطة!`,`Warning: Has ${deleteTarget?.activeLoans} active loan(s)!`)}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="dark:border-slate-700 dark:text-slate-300">{t('إلغاء','Cancel')}</Button>
            <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 disabled:opacity-60">
              {deleting ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
              {deleting ? t('جاري الحذف...','Deleting...') : t('حذف نهائي','Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          EMAIL DIALOG
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={emailOpen} onOpenChange={open => { if (!open) { setEmailOpen(false); setEmailUser(null); setShowTemplates(false); } }}>
        <DialogContent className="max-w-lg dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="font-black text-lg flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400"/>
              </div>
              {emailIsBulk ? t('إرسال بريد جماعي','Bulk Email') : t('إرسال بريد إلكتروني','Send Email')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-1 py-2">
            {/* Recipients info */}
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900 rounded-xl px-4 py-2.5 text-sm flex items-center justify-between gap-2">
              {emailIsBulk ? (
                <p className="text-blue-700 dark:text-blue-400 font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 shrink-0"/>
                  {t(`الإرسال إلى ${selected.size} مستخدم`, `Sending to ${selected.size} user(s)`)}
                </p>
              ) : (
                <p className="text-blue-700 dark:text-blue-400 font-bold flex items-center gap-2">
                  <Mail className="w-4 h-4 shrink-0"/>
                  {emailUser?.email ?? '—'}
                </p>
              )}
            </div>

            {/* زر القوالب */}
            <div>
              <button
                onClick={() => setShowTemplates(p => !p)}
                className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-3 py-1.5 rounded-xl transition-colors w-full justify-center">
                <Sparkles className="w-3.5 h-3.5"/>
                {showTemplates ? t('إخفاء القوالب','Hide Templates') : t('اختر قالب جاهز','Choose a Template')}
                <span className="ml-auto text-purple-400 font-mono text-[10px]">{EMAIL_TEMPLATES.length} {t('قالب','templates')}</span>
              </button>

              {showTemplates && (
                <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {EMAIL_TEMPLATES.map(tpl => (
                      <button key={tpl.id}
                        onClick={() => { setEmailSubject(tpl.subject); setEmailBody(tpl.body); setShowTemplates(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-start group">
                        <span className="text-xl shrink-0">{tpl.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">{tpl.label}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{tpl.subject}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('الموضوع *','Subject *')}</Label>
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                placeholder={t('موضوع الرسالة...','Message subject...')}
                className="dark:bg-slate-950 dark:border-slate-700 dark:text-white"/>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                {t('نص الرسالة *','Message Body *')}
                <span className="text-blue-400 font-normal text-[10px]">{t('استخدم {name} لاسم المستخدم','use {name} for user name')}</span>
              </Label>
              <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
                placeholder={t('مرحباً {name}، ...','Hello {name},...')}
                rows={5}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"/>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEmailOpen(false); setEmailUser(null); }} className="dark:border-slate-700 dark:text-slate-300">{t('إلغاء','Cancel')}</Button>
            <Button onClick={sendEmail} disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 disabled:opacity-60">
              {sendingEmail ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
              {sendingEmail ? t('جاري الإرسال...','Sending...') : t('إرسال','Send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          CSV IMPORT DIALOG
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={csvOpen} onOpenChange={open => !open && setCsvOpen(false)}>
        <DialogContent className="max-w-2xl dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="font-black text-lg flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400"/>
              </div>
              {t('استيراد مستخدمين من CSV','Import Users from CSV')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-1 py-2">
            {/* Format guide */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
              <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('صيغة الملف المطلوبة','Required Format')}</p>
              <code className="text-xs text-emerald-600 dark:text-emerald-400 font-mono block">
                رقم_الطالب, الاسم, الجوال, البريد, الدور
              </code>
              <code className="text-xs text-slate-500 dark:text-slate-400 font-mono block">
                441001, أحمد الغامدي, 0512345678, ahmed@email.com, طالب
              </code>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t('* الدور: طالب / مهندس / مشرف (اختياري، الافتراضي: طالب)','* Role: طالب/مهندس/مشرف (optional, default: طالب)')}</p>
            </div>

            {/* File upload */}
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2 font-bold border-slate-300 dark:border-slate-700 dark:text-slate-300">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600"/>
                {t('رفع ملف CSV','Upload CSV File')}
              </Button>
              <span className="text-sm text-slate-400 dark:text-slate-500">{t('أو الصق البيانات يدوياً أدناه','or paste data below manually')}</span>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload}/>
            </div>

            {/* Text area */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('بيانات CSV (الصق هنا)','CSV Data (paste here)')}</Label>
              <textarea value={csvText}
                onChange={e => { setCsvText(e.target.value); parseCSV(e.target.value); }}
                rows={5} dir="ltr"
                placeholder="441001,أحمد الغامدي,0512345678,ahmed@email.com,طالب"
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"/>
            </div>

            {/* Preview table */}
            {csvRows.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-950 px-4 py-2 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase">{t('معاينة البيانات','Data Preview')}</p>
                  <span className="text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">
                    {csvRows.length} {t('صف','rows')}
                  </span>
                </div>
                <div className="overflow-x-auto max-h-40">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-900">
                      <tr>{[t('الرقم','ID'),t('الاسم','Name'),t('الجوال','Phone'),t('البريد','Email'),t('الدور','Role')].map(h => (
                        <th key={h} className="px-3 py-2 text-start font-bold text-slate-500 dark:text-slate-400">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {csvRows.slice(0,5).map((r,i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{r.universityId}</td>
                          <td className="px-3 py-2 font-medium text-slate-800 dark:text-white">{r.name}</td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{r.phone||'—'}</td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{r.email||'—'}</td>
                          <td className="px-3 py-2"><RoleBadge role={r.role||'طالب'}/></td>
                        </tr>
                      ))}
                      {csvRows.length > 5 && (
                        <tr><td colSpan={5} className="px-3 py-2 text-center text-slate-400 dark:text-slate-500 text-xs">
                          +{csvRows.length-5} {t('مزيد من الصفوف...','more rows...')}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCsvOpen(false); setCsvText(''); setCsvRows([]); }} className="dark:border-slate-700 dark:text-slate-300">{t('إلغاء','Cancel')}</Button>
            <Button onClick={importCSV} disabled={importing || csvRows.length === 0}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2 disabled:opacity-60">
              {importing ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
              {importing ? t('جاري الاستيراد...','Importing...') : t(`استيراد ${csvRows.length} مستخدم`,`Import ${csvRows.length} users`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AdminStudents;
