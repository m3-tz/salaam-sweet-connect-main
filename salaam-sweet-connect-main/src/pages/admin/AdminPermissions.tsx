import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '../../LanguageContext';
import { apiUrl } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Shield, ShieldCheck, ShieldAlert, ChevronDown, ChevronRight,
  Save, Plus, Trash2, Users, Search, Check, X, Crown, RefreshCw,
  Eye, Edit3, ShoppingBag, MapPin, ClipboardList, Tent, BookOpen,
  Activity, Mail, Lock, Package, LayoutDashboard
} from 'lucide-react';

interface Permission {
  id: number;
  key: string;
  label_ar: string;
  label_en: string;
  category: string;
}

interface RoleData {
  role: string;
  permissions: string[];
  is_super: boolean;
}

// أيقونات الفئات
const categoryIcons: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  inventory: Package,
  locations: MapPin,
  loans: ClipboardList,
  requests: ShoppingBag,
  camps: Tent,
  students: Users,
  batches: BookOpen,
  audit: Activity,
  permissions: Shield,
  email: Mail,
};

// ألوان الفئات
const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  dashboard:   { bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-700 dark:text-blue-300',   border: 'border-blue-200 dark:border-blue-800' },
  inventory:   { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  locations:   { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800' },
  loans:       { bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-700 dark:text-amber-300',   border: 'border-amber-200 dark:border-amber-800' },
  requests:    { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
  camps:       { bg: 'bg-teal-50 dark:bg-teal-900/20',    text: 'text-teal-700 dark:text-teal-300',    border: 'border-teal-200 dark:border-teal-800' },
  students:    { bg: 'bg-pink-50 dark:bg-pink-900/20',    text: 'text-pink-700 dark:text-pink-300',    border: 'border-pink-200 dark:border-pink-800' },
  batches:     { bg: 'bg-cyan-50 dark:bg-cyan-900/20',    text: 'text-cyan-700 dark:text-cyan-300',    border: 'border-cyan-200 dark:border-cyan-800' },
  audit:       { bg: 'bg-slate-50 dark:bg-slate-800/50',   text: 'text-slate-700 dark:text-slate-300',   border: 'border-slate-200 dark:border-slate-700' },
  permissions: { bg: 'bg-red-50 dark:bg-red-900/20',      text: 'text-red-700 dark:text-red-300',      border: 'border-red-200 dark:border-red-800' },
  email:       { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
};

const categoryLabels: Record<string, { ar: string; en: string }> = {
  dashboard:   { ar: 'لوحة التحكم',    en: 'Dashboard' },
  inventory:   { ar: 'المخزون',        en: 'Inventory' },
  locations:   { ar: 'المواقع',        en: 'Locations' },
  loans:       { ar: 'العهد',          en: 'Loans' },
  requests:    { ar: 'الطلبات',        en: 'Requests' },
  camps:       { ar: 'المعسكرات',      en: 'Camps' },
  students:    { ar: 'المستخدمون',     en: 'Users' },
  batches:     { ar: 'الدفعات',        en: 'Batches' },
  audit:       { ar: 'سجل النظام',     en: 'Audit Logs' },
  permissions: { ar: 'الصلاحيات',      en: 'Permissions' },
  email:       { ar: 'البريد',         en: 'Email' },
};

const roleColors: Record<string, string> = {
  'مشرف':  'bg-red-500',
  'admin':  'bg-red-500',
  'مهندس': 'bg-blue-500',
  'طالب':  'bg-green-500',
};

const AdminPermissions = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();

  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newRoleOpen, setNewRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/permissions/roles'));
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          setAllPermissions(data.data.all_permissions);
          setRoles(data.data.roles);
          // تحديد أول رتبة
          if (!selectedRole && data.data.roles.length > 0) {
            const first = data.data.roles[0].role;
            setSelectedRole(first);
            setRolePerms(data.data.roles[0].permissions);
          }
          // توسيع كل الفئات
          const cats = new Set(data.data.all_permissions.map((p: Permission) => p.category));
          setExpandedCategories(cats as Set<string>);
        }
      }
    } catch (err) {
      console.error(err);
      toast({ title: t('خطأ في تحميل الصلاحيات', 'Error loading permissions'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  // عند اختيار رتبة
  const selectRole = (role: string) => {
    if (hasChanges) {
      if (!confirm(t('لديك تغييرات غير محفوظة. متأكد تبي تغير الرتبة؟', 'You have unsaved changes. Switch role anyway?'))) return;
    }
    setSelectedRole(role);
    const rd = roles.find(r => r.role === role);
    setRolePerms(rd?.permissions || []);
    setHasChanges(false);
  };

  // تفعيل/إلغاء صلاحية
  const togglePerm = (key: string) => {
    setRolePerms(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      setHasChanges(true);
      return next;
    });
  };

  // تفعيل/إلغاء فئة كاملة
  const toggleCategory = (cat: string) => {
    const catPerms = allPermissions.filter(p => p.category === cat).map(p => p.key);
    const allEnabled = catPerms.every(k => rolePerms.includes(k));
    setRolePerms(prev => {
      if (allEnabled) {
        return prev.filter(k => !catPerms.includes(k));
      } else {
        const existing = new Set(prev);
        catPerms.forEach(k => existing.add(k));
        return Array.from(existing);
      }
    });
    setHasChanges(true);
  };

  // حفظ
  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/permissions/role'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'admin-id': user?.id || '',
          'admin-name': encodeURIComponent(user?.name || ''),
        },
        body: JSON.stringify({ role: selectedRole, permissions: rolePerms }),
      });
      if (res.ok) {
        toast({ title: t('تم الحفظ بنجاح ✅', 'Saved successfully ✅') });
        setHasChanges(false);
        // تحديث القائمة المحلية
        setRoles(prev => prev.map(r => r.role === selectedRole ? { ...r, permissions: rolePerms } : r));
      } else {
        const d = await res.json();
        toast({ title: d.message || t('خطأ', 'Error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // إنشاء رتبة جديدة
  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      const res = await fetch(apiUrl('/api/permissions/role/new'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'admin-id': user?.id || '',
          'admin-name': encodeURIComponent(user?.name || ''),
        },
        body: JSON.stringify({ role: newRoleName.trim(), permissions: [] }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: t('تم إنشاء الرتبة ✅', 'Role created ✅') });
        setNewRoleOpen(false);
        setNewRoleName('');
        fetchData();
      } else {
        toast({ title: d.message || t('خطأ', 'Error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' });
    }
  };

  // حذف رتبة
  const handleDeleteRole = async (role: string) => {
    if (!confirm(t(`هل أنت متأكد من حذف الرتبة "${role}"؟`, `Are you sure you want to delete role "${role}"?`))) return;
    try {
      const res = await fetch(apiUrl('/api/permissions/role'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'admin-id': user?.id || '',
          'admin-name': encodeURIComponent(user?.name || ''),
        },
        body: JSON.stringify({ role }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: t('تم الحذف ✅', 'Deleted ✅') });
        fetchData();
      } else {
        toast({ title: d.message || t('خطأ', 'Error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' });
    }
  };

  // تجميع الصلاحيات حسب الفئة
  const groupedPerms = allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  // فلترة بالبحث
  const filteredCategories = Object.entries(groupedPerms).filter(([cat, perms]) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const catLabel = categoryLabels[cat];
    if (catLabel?.ar.includes(q) || catLabel?.en.toLowerCase().includes(q)) return true;
    return perms.some(p => p.key.includes(q) || p.label_ar.includes(q) || p.label_en.toLowerCase().includes(q));
  });

  const currentRoleData = roles.find(r => r.role === selectedRole);
  const isSystemRole = ['مشرف', 'admin', 'مهندس', 'طالب'].includes(selectedRole);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">{t('إدارة الصلاحيات', 'Permissions Manager')}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t('تحكم في صلاحيات كل رتبة بشكل دقيق', 'Granular role-based access control')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setNewRoleOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <Plus className="w-4 h-4" /> {t('رتبة جديدة', 'New Role')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* قائمة الرتب */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Users className="w-4 h-4" /> {t('الرتب', 'Roles')}
              </h3>
            </div>
            <div className="p-2 space-y-1">
              {roles.map(r => {
                const permCount = r.permissions.length;
                const totalPerms = allPermissions.length;
                const pct = totalPerms > 0 ? Math.round((permCount / totalPerms) * 100) : 0;
                return (
                  <button
                    key={r.role}
                    onClick={() => selectRole(r.role)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all ${
                      selectedRole === r.role
                        ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 shadow-sm'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${roleColors[r.role] || 'bg-gray-400'} shrink-0`} />
                    <div className="flex-1 text-start min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold truncate ${selectedRole === r.role ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>
                          {r.role}
                        </span>
                        {r.is_super && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">{permCount}/{totalPerms}</span>
                      </div>
                    </div>
                    {!isSystemRole && selectedRole === r.role && !r.is_super && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteRole(r.role); }} className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* لوحة الصلاحيات */}
        <div className="lg:col-span-3">
          {selectedRole ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              {/* Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${roleColors[selectedRole] || 'bg-gray-400'} flex items-center justify-center`}>
                    {currentRoleData?.is_super ? <Crown className="w-5 h-5 text-white" /> : <Shield className="w-5 h-5 text-white" />}
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-slate-800 dark:text-white">{selectedRole}</h3>
                    <p className="text-xs text-slate-400">
                      {rolePerms.length} / {allPermissions.length} {t('صلاحية', 'permissions')}
                      {hasChanges && <span className="text-amber-500 font-bold mr-2 ml-2">• {t('تغييرات غير محفوظة', 'unsaved changes')}</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                    <Input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={t('ابحث عن صلاحية...', 'Search permissions...')}
                      className={`${lang === 'ar' ? 'pr-9' : 'pl-9'} bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700`}
                    />
                  </div>
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || saving || currentRoleData?.is_super}
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shrink-0"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? t('جاري الحفظ...', 'Saving...') : t('حفظ', 'Save')}
                  </Button>
                </div>
              </div>

              {/* Permissions grid */}
              {currentRoleData?.is_super ? (
                <div className="p-8 text-center">
                  <ShieldCheck className="w-16 h-16 text-emerald-400 mx-auto mb-3" />
                  <h4 className="font-black text-lg text-slate-800 dark:text-white mb-1">{t('صلاحيات كاملة', 'Full Access')}</h4>
                  <p className="text-slate-400 text-sm">{t('هذه الرتبة لديها جميع الصلاحيات تلقائياً ولا يمكن تعديلها', 'This role has all permissions by default and cannot be modified')}</p>
                </div>
              ) : (
                <div className="p-4 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto custom-scrollbar">
                  {filteredCategories.map(([cat, perms]) => {
                    const isExpanded = expandedCategories.has(cat);
                    const CatIcon = categoryIcons[cat] || Shield;
                    const colors = categoryColors[cat] || categoryColors.audit;
                    const catLabel = categoryLabels[cat] || { ar: cat, en: cat };
                    const catPerms = perms.map(p => p.key);
                    const enabledCount = catPerms.filter(k => rolePerms.includes(k)).length;
                    const allEnabled = enabledCount === catPerms.length;
                    const someEnabled = enabledCount > 0 && !allEnabled;

                    return (
                      <div key={cat} className={`rounded-xl border ${colors.border} overflow-hidden transition-all`}>
                        {/* Category header */}
                        <div
                          className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${colors.bg} hover:opacity-90`}
                          onClick={() => setExpandedCategories(prev => {
                            const next = new Set(prev);
                            next.has(cat) ? next.delete(cat) : next.add(cat);
                            return next;
                          })}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronDown className={`w-4 h-4 ${colors.text}`} /> : <ChevronRight className={`w-4 h-4 ${colors.text}`} />}
                            <CatIcon className={`w-5 h-5 ${colors.text}`} />
                            <span className={`font-bold text-sm ${colors.text}`}>{t(catLabel.ar, catLabel.en)}</span>
                            <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                              allEnabled ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                              : someEnabled ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                            }`}>
                              {enabledCount}/{catPerms.length}
                            </span>
                          </div>

                          {/* Toggle all */}
                          <button
                            onClick={e => { e.stopPropagation(); toggleCategory(cat); }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                              allEnabled
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
                            }`}
                          >
                            {allEnabled ? t('إلغاء الكل', 'Uncheck All') : t('تفعيل الكل', 'Check All')}
                          </button>
                        </div>

                        {/* Permissions list */}
                        {isExpanded && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-2 bg-white dark:bg-slate-900/50">
                            {perms.map(perm => {
                              const isEnabled = rolePerms.includes(perm.key);
                              // فلتر البحث داخل الفئة
                              if (searchQuery) {
                                const q = searchQuery.toLowerCase();
                                if (!perm.key.includes(q) && !perm.label_ar.includes(q) && !perm.label_en.toLowerCase().includes(q)) return null;
                              }
                              return (
                                <button
                                  key={perm.key}
                                  onClick={() => togglePerm(perm.key)}
                                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                                    isEnabled
                                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                                      : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                  }`}
                                >
                                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                                    isEnabled
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-slate-200 dark:bg-slate-600'
                                  }`}>
                                    {isEnabled && <Check className="w-3.5 h-3.5" />}
                                  </div>
                                  <div className="flex-1 text-start min-w-0">
                                    <p className={`font-bold text-xs truncate ${isEnabled ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'}`}>
                                      {t(perm.label_ar, perm.label_en)}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-mono truncate">{perm.key}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {filteredCategories.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                      <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-bold">{t('لا توجد نتائج', 'No results')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center shadow-sm">
              <Shield className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h4 className="font-bold text-slate-500 dark:text-slate-400">{t('اختر رتبة لعرض صلاحياتها', 'Select a role to view permissions')}</h4>
            </div>
          )}
        </div>
      </div>

      {/* Dialog إنشاء رتبة جديدة */}
      <Dialog open={newRoleOpen} onOpenChange={setNewRoleOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-800 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-500" />
              {t('إنشاء رتبة جديدة', 'Create New Role')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                {t('اسم الرتبة', 'Role Name')}
              </label>
              <Input
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                placeholder={t('مثال: مساعد مهندس', 'e.g. Assistant Engineer')}
                className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
              />
              <p className="text-xs text-slate-400 mt-1">{t('سيتم إنشاء الرتبة بدون صلاحيات، يمكنك إضافتها بعد ذلك', 'Role will be created with no permissions, you can add them after')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRoleOpen(false)} className="dark:border-slate-600 dark:text-slate-300">
              {t('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleCreateRole} disabled={!newRoleName.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Plus className="w-4 h-4" /> {t('إنشاء', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPermissions;
