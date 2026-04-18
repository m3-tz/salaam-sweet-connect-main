import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from "@/components/ui/context-menu";
import {
  Plus,
  Package,
  RotateCcw,
  Tent,
  CheckCircle2,
  Search,
  Trash2,
  Calendar,
  User,
  Info,
  MapPin,
  ShoppingCart,
  Pencil,
  ShieldAlert,
  Layers,
  ChevronDown,
  ChevronRight,
  Home,
  Map,
  Server,
  AlignJustify,
  Archive,
  ShoppingBasket,
  X,
  AlertTriangle,
  Clock,
  BarChart2,
  ScanLine
} from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useToast } from '@/hooks/use-toast';

import { useLanguage } from '../../LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiUrl } from '@/lib/api';
import LocationBadge from '@/components/LocationBadge';

type LocType = 'Room' | 'Zone' | 'Cabinet' | 'Rack' | 'Shelf' | 'Drawer' | 'Box' | 'Bin';

interface StorageLocation {
  id: number;
  name: string;
  type: LocType;
  parent_id: number | null;
  barcode: string;
  description: string;
  max_capacity: number;
  children?: StorageLocation[];
}

interface Device {
  name?: string;
  name_ar?: string;
  name_en?: string;
  quantity: number;
  category?: string;
  category_ar?: string;
  category_en?: string;
  location?: string;
  location_ids?: number[];
  imageUrl: string;
}

interface CampItem {
  componentName: string;
  quantity: number;
  returned?: boolean;
}

interface Camp {
  id: number;
  name: string;
  organization: string;
  responsible: string;
  createdDate: string;
  expectedReturnDate: string;
  status: string;
  items: CampItem[];
}

interface ApiCampData {
  id: number;
  camp_name?: string;
  name?: string;
  room_number?: string;
  organization?: string;
  receiver_name?: string;
  responsible?: string;
  return_date?: string;
  expectedReturnDate?: string;
  status: string;
  items?: CampItem[];
}

const AdminCamps = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'مشرف' || user?.role?.toLowerCase() === 'admin';

  const { lang, t } = useLanguage();
  const { toast } = useToast();
  const { theme } = useTheme();

  const [camps, setCamps] = useState<Camp[]>([]);
  const [inventory, setInventory] = useState<Device[]>([]);
  const [flatLocations, setFlatLocations] = useState<StorageLocation[]>([]);
  const [locationTree, setLocationTree] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const [campSearch, setCampSearch] = useState('');
  const [campFilter, setCampFilter] = useState<'all' | 'active' | 'returned' | 'overdue'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const isOverdue = (camp: Camp) =>
    camp.status === 'active' && !!camp.expectedReturnDate && new Date(camp.expectedReturnDate) < new Date();

  const activeCampsCount = camps.filter(c => c.status === 'active').length;
  const overdueCampsCount = camps.filter(isOverdue).length;
  const totalItemsOut = camps
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + (c.items?.reduce((s, i) => s + i.quantity, 0) || 0), 0);

  const filteredCamps = useMemo(() => {
    return camps.filter(camp => {
      const q = campSearch.toLowerCase();
      const matchesSearch = !q ||
        camp.name.toLowerCase().includes(q) ||
        camp.organization.toLowerCase().includes(q) ||
        camp.responsible.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (campFilter === 'active') return camp.status === 'active' && !isOverdue(camp);
      if (campFilter === 'returned') return camp.status === 'returned';
      if (campFilter === 'overdue') return isOverdue(camp);
      return true;
    });
  }, [camps, campSearch, campFilter]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCampId, setEditingCampId] = useState<number | null>(null);

  const [form, setForm] = useState({ name: '', organization: '', responsible: '', expectedReturnDate: '' });
  const [cart, setCart] = useState<{ component: Device; quantity: number }[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [isLocPickerOpen, setIsLocPickerOpen] = useState(false);
  const [selectedLocFilter, setSelectedLocFilter] = useState<number | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  const getNameAr = (c: Device) => c.name_ar || c.name || '';
  const getNameEn = (c: Device) => c.name_en || c.name_ar || c.name || '';
  const getCatAr = (c: Device) => c.category_ar || c.category || 'عام';
  const getCatEn = (c: Device) => c.category_en || c.category_ar || c.category || 'General';
  const displayCompName = (c: Device) => lang === 'ar' ? getNameAr(c) : getNameEn(c);

  const getIcon = (type: string, className = "w-4 h-4") => {
    switch(type) {
      case 'Room': return <Home className={`${className} text-indigo-500`} />;
      case 'Zone': return <Map className={`${className} text-purple-500`} />;
      case 'Cabinet': return <Server className={`${className} text-blue-500`} />;
      case 'Rack': return <AlignJustify className={`${className} text-cyan-500`} />;
      case 'Shelf': return <Layers className={`${className} text-orange-500`} />;
      case 'Drawer': return <Archive className={`${className} text-amber-500`} />;
      case 'Box': return <Package className={`${className} text-emerald-500`} />;
      case 'Bin': return <ShoppingBasket className={`${className} text-teal-500`} />;
      default: return <MapPin className={className} />;
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, campsRes, locsRes] = await Promise.all([
        fetch(apiUrl('/api/items')),
        fetch(apiUrl('/api/camps')),
        fetch(apiUrl('/api/admin/locations'))
      ]);

      if (invRes.ok) setInventory((await invRes.json()).data);

      if (campsRes.ok) {
          const campsData = await campsRes.json();
          const formattedCamps = campsData.data.map((camp: ApiCampData) => ({
              id: camp.id,
              name: camp.camp_name || camp.name || '',
              organization: camp.room_number || camp.organization || '',
              responsible: camp.receiver_name || camp.responsible || '',
              expectedReturnDate: camp.expectedReturnDate || camp.return_date || '',
              status: camp.status,
              items: camp.items || []
          }));
          setCamps(formattedCamps);
      }

      if (locsRes.ok) {
          const locData = (await locsRes.json()).data;
          setFlatLocations(locData);
          setLocationTree(buildTree(locData));
      }
    } catch (error) {
      toast({ title: t('خطأ', 'Error'), description: t('تأكد من تشغيل السيرفر', 'Make sure backend is running'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) fetchData();
    else setLoading(false);
  }, [isSuperAdmin]);

  const buildTree = (locs: StorageLocation[]) => {
    const map: Record<number, StorageLocation> = {};
    const tree: StorageLocation[] = [];
    locs.forEach(l => map[l.id] = { ...l, children: [] });
    locs.forEach(l => {
      if (l.parent_id && map[l.parent_id]) map[l.parent_id].children!.push(map[l.id]);
      else tree.push(map[l.id]);
    });
    return tree;
  };

  const locationPathMap = useMemo(() => {
    const map = new globalThis.Map<number, string>();
    flatLocations.forEach(loc => {
      const path = [loc.name];
      let parentId = loc.parent_id;
      let depth = 0;
      while (parentId && depth < 5) {
        const parent = flatLocations.find(l => l.id === parentId);
        if (parent) { path.unshift(parent.name); parentId = parent.parent_id; }
        else break;
        depth++;
      }
      map.set(loc.id, path.join(' ➔ '));
    });
    return map;
  }, [flatLocations]);

  const getFullLocationPath = (locId: number): string => locationPathMap.get(locId) || '';

  const processBarcode = (raw: string) => {
    const barcode = raw.trim();
    const found = flatLocations.find(l =>
      l.barcode === barcode || l.name === barcode || String(l.id) === barcode
    );
    if (found) {
      setSelectedLocFilter(found.id);
      setIsScannerOpen(false);
      toast({ title: t('تم تحديد الموقع 📦', 'Location set 📦'), description: getFullLocationPath(found.id) || found.name });
    } else {
      toast({ title: t('لم يُعثر على الموقع', 'Location not found'), description: barcode, variant: 'destructive' });
    }
  };

  const getChildIds = (id: number): number[] => {
    const children = flatLocations.filter(l => l.parent_id === id).map(l => l.id);
    let all = [id, ...children];
    children.forEach(c => { all = [...all, ...getChildIds(c)] });
    return all;
  };

  const allCategories = lang === 'ar' ? ['All', ...Array.from(new Set(inventory.map(item => getCatAr(item)).filter(Boolean)))] : ['All', ...Array.from(new Set(inventory.map(item => getCatEn(item)).filter(Boolean)))];

  const filteredComps = useMemo(() => {
    return inventory.filter(c => {
      const searchLower = searchQ.toLowerCase();
      const matchesSearch = getNameAr(c).toLowerCase().includes(searchLower) || getNameEn(c).toLowerCase().includes(searchLower);
      const matchesCategory = selectedCategory === 'All' || getCatAr(c) === selectedCategory || getCatEn(c) === selectedCategory;

      let matchesLocation = true;
      if (selectedLocFilter !== null) {
          const relevantIds = getChildIds(selectedLocFilter);
          matchesLocation = c.location_ids?.some(id => relevantIds.includes(id)) || false;
      }

      return c.quantity > 0 && matchesSearch && matchesCategory && matchesLocation;
    });
  }, [inventory, searchQ, selectedCategory, selectedLocFilter, lang]);

  const addToCart = (comp: Device) => {
    setCart(prev => {
      const existing = prev.find(i => getNameAr(i.component) === getNameAr(comp));
      if (existing) {
        if (existing.quantity >= comp.quantity) {
          toast({ title: t('تنبيه', 'Warning'), description: t('الكمية المطلوبة غير متوفرة', 'Quantity not available'), variant: 'destructive' });
          return prev;
        }
        return prev.map(i => getNameAr(i.component) === getNameAr(comp) ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { component: comp, quantity: 1 }];
    });
  };

  const updateCartQty = (compNameAr: string, qty: number) => {
    const stockItem = inventory.find(i => getNameAr(i) === compNameAr);
    if (stockItem && qty > stockItem.quantity) {
      toast({ title: t('تنبيه', 'Warning'), description: t('الكمية تتجاوز المتوفر', 'Quantity exceeds stock'), variant: 'destructive' });
      return;
    }
    if (qty <= 0) setCart(prev => prev.filter(i => getNameAr(i.component) !== compNameAr));
    else setCart(prev => prev.map(i => getNameAr(i.component) === compNameAr ? { ...i, quantity: qty } : i));
  };

  const openAddDialog = () => {
    setIsEditMode(false); setEditingCampId(null); setForm({ name: '', organization: '', responsible: '', expectedReturnDate: '' }); setCart([]); setSearchQ(''); setSelectedCategory('All'); setSelectedLocFilter(null); setDialogOpen(true);
  };

  const openEditDialog = (camp: Camp) => {
    setIsEditMode(true); setEditingCampId(camp.id); setForm({ name: camp.name, organization: camp.organization, responsible: camp.responsible, expectedReturnDate: camp.expectedReturnDate }); setDialogOpen(true);
  };

  const resetDialog = () => { setDialogOpen(false); setIsEditMode(false); setEditingCampId(null); };

  const handleSave = async () => {
    if (!form.name || !form.organization) return;
    if (!isEditMode && cart.length === 0) return;

    const items = cart.map(ci => ({ name: getNameAr(ci.component), qty: ci.quantity }));
    const endpoint = isEditMode ? apiUrl(`/api/camps/${editingCampId}`) : apiUrl('/api/camps');
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
        body: JSON.stringify({ campName: form.name, roomNumber: form.organization, receiverName: form.responsible, returnDate: form.expectedReturnDate, items: items })
      });

      if (res.ok) {
        toast({ title: isEditMode ? t('تم التعديل بنجاح ✅', 'Updated successfully ✅') : t('تم إنشاء المعسكر بنجاح ✅', 'Camp created successfully ✅'), description: form.name });
        resetDialog(); fetchData();
      } else { toast({ title: t('خطأ', 'Error'), description: t('فشل في حفظ البيانات', 'Failed to save data'), variant: 'destructive' }); }
    } catch (error) { toast({ title: t('خطأ اتصال', 'Connection Error'), variant: 'destructive' }); }
  };

  const handleReturnAll = async (campId: number) => {
    try {
      const res = await fetch(apiUrl(`/api/camps/return/${campId}`), { method: 'POST', headers: { 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') } });
      if (res.ok) { toast({ title: t('تم تسجيل الإرجاع بنجاح ✅', 'Returned successfully ✅') }); fetchData(); }
    } catch (error) { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const handleDeleteCamp = async (campId: number, campName: string) => {
    if (!confirm(t(`هل أنت متأكد من حذف معسكر "${campName}" نهائياً؟ سيتم إعادة الكميات للمخزون إذا كانت نشطة.`, `Are you sure you want to delete "${campName}"? Active quantities will be returned to stock.`))) return;
    try {
      const res = await fetch(apiUrl(`/api/camps/${campId}`), { method: 'DELETE', headers: { 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') } });
      if (res.ok) { toast({ title: t('تم حذف المعسكر بنجاح 🗑️', 'Camp deleted successfully 🗑️') }); fetchData(); }
      else { toast({ title: t('تنبيه', 'Warning'), description: t('فشلت عملية الحذف، يرجى تحديث الباك إند', 'Deletion failed, please update backend'), variant: 'destructive' }); }
    } catch (error) { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const totalCartItems = cart.reduce((s, i) => s + i.quantity, 0);

  // 🌳 مكون الشجرة المصغر لاختيار الموقع للفلترة (مغلق افتراضياً)
  const FilterPickerNode = ({ node }: { node: StorageLocation }) => {
    const [expanded, setExpanded] = useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedLocFilter === node.id;

    return (
        <div className="w-full">
            <div className="flex items-center gap-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md px-2 transition-colors">
                <div onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="w-6 h-6 flex items-center justify-center cursor-pointer bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    {hasChildren ? (expanded ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className={`w-4 h-4 ${lang==='ar'?'rotate-180':''}`}/>) : <span className="w-4 h-4"></span>}
                </div>
                <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => {
                        if (isSelected) setSelectedLocFilter(null);
                        else setSelectedLocFilter(node.id);
                        setIsLocPickerOpen(false);
                    }}>
                    {getIcon(node.type)}
                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{node.name}</span>
                    <span className="text-[10px] text-slate-400">({node.type})</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-auto ml-auto" />}
                </div>
            </div>
            {expanded && hasChildren && (
                <div style={{ marginInlineStart: '12px', borderInlineStart: '2px solid #e2e8f0', paddingInlineStart: '8px' }} className="mt-1 dark:border-slate-800">
                    {node.children!.map(child => <FilterPickerNode key={child.id} node={child} />)}
                </div>
            )}
        </div>
    );
  };

  if (!isSuperAdmin) {
    return (
      <div className={`flex flex-col items-center justify-center h-[70vh] space-y-4 transition-colors ${theme === 'dark' ? 'text-white' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="w-24 h-24 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mb-2 shadow-inner border border-red-100 dark:border-red-800"><ShieldAlert className="w-12 h-12" /></div>
        <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{t('عذراً، غير مصرح لك', 'Access Denied')}</h2>
        <p className="text-slate-500 dark:text-slate-400 font-bold text-center max-w-md">{t('صفحة المعسكرات مخصصة لمدير النظام (المشرف) فقط.', 'The Camps page is restricted to system administrators only.')}</p>
      </div>
    );
  }

  if (loading) return <div className="flex justify-center p-20"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6 pb-10 font-sans transition-colors" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4 transition-colors">
        <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
          <Tent className="w-6 h-6 text-blue-600" /> {t('إدارة المعسكرات والفعاليات', 'Camps & Events Management')}
        </h2>
        <Button onClick={openAddDialog} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-transform active:scale-95">
          <Plus className="w-4 h-4" /> {t('معسكر جديد', 'New Camp')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
            <Tent className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800 dark:text-white">{activeCampsCount}</p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('معسكر نشط', 'Active Camps')}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center shrink-0">
            <BarChart2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800 dark:text-white">{totalItemsOut}</p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('قطعة مصروفة', 'Items Out')}</p>
          </div>
        </div>
        <div className={`rounded-2xl p-4 flex items-center gap-4 shadow-sm border ${overdueCampsCount > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${overdueCampsCount > 0 ? 'bg-red-100 dark:bg-red-900/40' : 'bg-slate-50 dark:bg-slate-800'}`}>
            <AlertTriangle className={`w-6 h-6 ${overdueCampsCount > 0 ? 'text-red-500' : 'text-slate-400'}`} />
          </div>
          <div>
            <p className={`text-2xl font-black ${overdueCampsCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>{overdueCampsCount}</p>
            <p className={`text-xs font-bold ${overdueCampsCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>{t('معسكر متأخر', 'Overdue Camps')}</p>
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
          <input
            value={campSearch}
            onChange={e => setCampSearch(e.target.value)}
            placeholder={t('بحث باسم المعسكر أو الجهة أو المسؤول...', 'Search by camp, organization, or responsible...')}
            className={`w-full h-10 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 dark:text-white ${lang === 'ar' ? 'pr-9 pl-4' : 'pl-9 pr-4'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'active', 'returned', 'overdue'] as const).map(f => {
            const labels: Record<string, string> = {
              all: t('الكل', 'All'),
              active: t('نشط', 'Active'),
              returned: t('مُرجع', 'Returned'),
              overdue: t('متأخر ⚠️', 'Overdue ⚠️'),
            };
            const counts: Record<string, number> = {
              all: camps.length,
              active: camps.filter(c => c.status === 'active' && !isOverdue(c)).length,
              returned: camps.filter(c => c.status === 'returned').length,
              overdue: overdueCampsCount,
            };
            const active = campFilter === f;
            const isOverdueFilter = f === 'overdue';
            return (
              <button
                key={f}
                onClick={() => setCampFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  active
                    ? isOverdueFilter ? 'bg-red-500 text-white border-red-500' : 'bg-blue-600 text-white border-blue-600'
                    : isOverdueFilter && overdueCampsCount > 0 ? 'border-red-200 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-800 hover:bg-red-100' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {labels[f]}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${active ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{counts[f]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:gap-6">
        {filteredCamps.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 transition-colors">
            <Tent className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-bold text-lg">
              {campSearch || campFilter !== 'all' ? t('لا توجد نتائج مطابقة', 'No matching results') : t('لا توجد معسكرات مسجلة حالياً', 'No registered camps currently')}
            </p>
          </div>
        ) : (
          filteredCamps.map(camp => {
            const overdue = isOverdue(camp);
            return (
            <ContextMenu key={camp.id} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <ContextMenuTrigger asChild>
                <Card className={`transition-all cursor-context-menu dark:bg-slate-900 ${
                  camp.status === 'returned'
                    ? 'opacity-70 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                    : overdue
                      ? 'border-red-300 dark:border-red-800 shadow-md hover:shadow-lg border-t-4 border-t-red-500 bg-red-50/30 dark:bg-red-900/10'
                      : 'border-blue-200 dark:border-blue-900 shadow-md hover:shadow-lg border-t-4 border-t-blue-500'
                }`}>
                  <CardHeader className={`pb-4 ${overdue ? 'bg-red-50/40 dark:bg-red-900/10' : camp.status === 'active' ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''} transition-colors`}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center border-4 ${
                          overdue ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-500 shadow-sm'
                          : camp.status === 'active' ? 'bg-white dark:bg-slate-800 border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}>
                          {overdue ? <AlertTriangle className="w-6 h-6" /> : <Tent className="w-6 h-6" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-xl font-black text-slate-800 dark:text-white">{camp.name}</CardTitle>
                            {overdue && (
                              <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                <Clock className="w-3 h-3" /> {t('متأخر!', 'Overdue!')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5">{camp.organization}</p>
                          <div className="flex flex-wrap items-center gap-3 mt-2">
                            {camp.responsible && (
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-1 rounded-md border dark:border-slate-700 shadow-sm"><User className="w-3.5 h-3.5 text-blue-500" />{camp.responsible}</span>
                            )}
                            {camp.expectedReturnDate && (
                              <span className={`text-[11px] font-bold flex items-center gap-1.5 px-2 py-1 rounded-md border shadow-sm ${overdue ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                                <Calendar className={`w-3.5 h-3.5 ${overdue ? 'text-red-500' : 'text-orange-500'}`} />
                                {t('الإرجاع:', 'Return:')} {camp.expectedReturnDate}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 self-end sm:self-auto">
                        <span className={`text-xs font-black px-4 py-1.5 rounded-full shadow-sm border ${
                          overdue ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400'
                          : camp.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-800 text-green-800 dark:text-green-400'
                          : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}>
                          {overdue ? t('متأخر عن الإرجاع', 'Overdue') : camp.status === 'active' ? t('المعسكر نشط', 'Active Camp') : t('منتهي ومُرجع', 'Completed')}
                        </span>
                        <div className="flex gap-2 mt-1">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(camp)} className="gap-1.5 text-xs font-bold border-slate-300 dark:border-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800">
                            <Pencil className="w-3.5 h-3.5" /> {t('تعديل', 'Edit')}
                          </Button>
                          {camp.status === 'active' && (
                            <Button size="sm" onClick={() => handleReturnAll(camp.id)} className={`gap-1.5 text-xs font-bold text-white shadow-md ${overdue ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}>
                              <RotateCcw className="w-3.5 h-3.5" /> {t('إرجاع', 'Return')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-inner transition-colors">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 border-b dark:border-slate-800 pb-2 mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> {t('القطع المصروفة للمعسكر', 'Items issued for the camp')} ({camp.items?.length || 0})</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {camp.items?.map((item, i) => {
                          const stockItem = inventory.find(inv => getNameAr(inv) === item.componentName || inv.name === item.componentName);
                          const itemImage = stockItem?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png';
                          const itemName = stockItem ? displayCompName(stockItem) : item.componentName;

                          return (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                              <div className="w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-1 shrink-0 flex items-center justify-center overflow-hidden"><img src={itemImage} alt={itemName} className={`max-w-full max-h-full object-contain ${camp.status === 'returned' ? 'grayscale opacity-60' : ''}`} /></div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold truncate ${camp.status === 'returned' ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200'}`} title={itemName}>{itemName}</p>
                                <div className="mt-1.5 w-full">
                                  <LocationBadge
                                    location={
                                      stockItem?.location_ids?.length
                                        ? stockItem.location_ids.map(id => getFullLocationPath(id)).filter(Boolean).join(' | ')
                                        : stockItem?.location
                                    }
                                    small
                                  />
                                </div>
                              </div>
                              <div className="shrink-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border dark:border-slate-700">
                                <span className="text-[10px] font-bold text-slate-400">{t('الكمية', 'Qty')}</span>
                                <span className={`text-sm font-black ${camp.status === 'returned' ? 'text-slate-500 line-through' : 'text-blue-700 dark:text-blue-400'}`}>{item.quantity}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56 font-sans dark:bg-slate-900 dark:border-slate-800">
                <ContextMenuItem onClick={() => openEditDialog(camp)} className="gap-2 font-bold text-blue-600 dark:text-blue-400 focus:text-blue-700 dark:focus:bg-slate-800 cursor-pointer"><Pencil className="w-4 h-4" /> {t('تعديل تفاصيل المعسكر', 'Edit Camp Details')}</ContextMenuItem>
                <ContextMenuSeparator className="dark:bg-slate-800" />
                {camp.status === 'active' && (<ContextMenuItem onClick={() => handleReturnAll(camp.id)} className="gap-2 font-bold text-emerald-600 dark:text-emerald-400 focus:text-emerald-700 dark:focus:bg-slate-800 cursor-pointer"><RotateCcw className="w-4 h-4" /> {t('إرجاع جميع القطع فوراً', 'Return All Items Now')}</ContextMenuItem>)}
                {camp.status === 'active' && <ContextMenuSeparator className="dark:bg-slate-800"/>}
                <ContextMenuItem onClick={() => handleDeleteCamp(camp.id, camp.name)} className="gap-2 font-bold text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:bg-slate-800 cursor-pointer"><Trash2 className="w-4 h-4" /> {t('حذف المعسكر نهائياً', 'Delete Camp Permanently')}</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            );
          })
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`max-w-5xl max-h-[90vh] flex flex-col overflow-hidden p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
            <DialogTitle className="text-xl font-black text-blue-600 dark:text-blue-400 flex items-center gap-2">{isEditMode ? <Pencil className="w-6 h-6"/> : <Tent className="w-6 h-6"/>}{isEditMode ? t('تعديل تفاصيل المعسكر', 'Edit Camp Details') : t('إنشاء معسكر / فعالية جديدة', 'Create New Camp')}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
              <div className="col-span-1 md:col-span-2 space-y-2"><Label className="font-bold text-slate-700 dark:text-slate-300">{t('اسم المعسكر / الفعالية', 'Camp / Event Name')}</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('مثال: هاكاثون الابتكار', 'Example: Innovation Hackathon')} className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold dark:text-white" /></div>
              <div className="space-y-2"><Label className="font-bold text-slate-700 dark:text-slate-300">{t('الجهة / المنظمة', 'Organization')}</Label><Input value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} placeholder={t('نادي الذكاء الاصطناعي', 'AI Club')} className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white" /></div>
              <div className="space-y-2"><Label className="font-bold text-slate-700 dark:text-slate-300">{t('المسؤول (المستلم)', 'Responsible (Receiver)')}</Label><Input value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} placeholder={t('اسم المشرف أو الطالب', 'Supervisor or Student Name')} className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white" /></div>
              <div className="col-span-1 md:col-span-2 space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2"><Label className="font-bold text-slate-700 dark:text-slate-300">{t('تاريخ الإرجاع المتوقع', 'Expected Return Date')}</Label><Input type="date" value={form.expectedReturnDate} onChange={e => setForm(f => ({ ...f, expectedReturnDate: e.target.value }))} className={`w-full sm:w-1/2 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold dark:text-white ${lang === 'ar' ? 'text-right' : 'text-left'}`} /></div>
            </div>

            {!isEditMode && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-6">
                <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col h-[500px]">
                  <div className="flex flex-col gap-3 mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2"><Layers className="w-4 h-4 text-blue-500"/> {t('1. تصفح واختر القطع', '1. Browse & Select Items')}</h3>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                        <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder={t("بحث باسم القطعة...", "Search by item name...")} className={`${lang === 'ar' ? 'pr-9' : 'pl-9'} h-10 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-white`} />
                      </div>
                      <Button variant="outline" onClick={() => setIsScannerOpen(true)} className="h-10 px-3 border-purple-200 dark:border-purple-900/50 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 shrink-0" title={t('مسح باركود الموقع', 'Scan location barcode')}>
                        <ScanLine className="w-4 h-4"/>
                      </Button>
                      <Button variant={selectedLocFilter ? "default" : "outline"} onClick={() => setIsLocPickerOpen(true)} className="h-10 text-xs font-bold gap-2 whitespace-nowrap"><MapPin className="w-4 h-4"/> {selectedLocFilter ? t('تغيير الموقع', 'Change Loc') : t('فلتر بالموقع', 'Filter by Loc')}</Button>
                      {selectedLocFilter && <Button variant="ghost" onClick={() => setSelectedLocFilter(null)} className="h-10 px-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"><X className="w-4 h-4"/></Button>}
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                       {allCategories.map(cat => (
                          <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${selectedCategory === cat ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700'}`}>
                            {cat === 'All' ? t('الكل', 'All') : cat}
                          </button>
                       ))}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredComps.map(comp => {
                        const inCart = cart.find(i => getNameAr(i.component) === getNameAr(comp));
                        return (
                          <div key={getNameAr(comp)} className={`flex items-center gap-3 p-2.5 rounded-xl border ${lang === 'ar' ? 'text-right' : 'text-left'} transition-all ${inCart ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 shadow-sm' : 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-200'}`}>
                            <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-1 shrink-0 flex justify-center items-center"><img src={comp.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png'} alt="" className="max-h-full object-contain" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }} /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mb-1" title={displayCompName(comp)}>{displayCompName(comp)}</p>
                              <LocationBadge
                                location={
                                  comp.location_ids?.length
                                    ? comp.location_ids.map(id => getFullLocationPath(id)).filter(Boolean).join(' | ')
                                    : comp.location
                                }
                                small
                              />
                            </div>
                            <div className="shrink-0 flex flex-col gap-1.5 items-end">
                               <span className="text-[10px] font-black bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800">{t('متاح:', 'Avail:')} {comp.quantity}</span>
                               {!inCart ? (
                                 <Button size="sm" onClick={(e) => { e.preventDefault(); addToCart(comp); }} className="h-7 px-3 text-[10px] font-bold gap-1 bg-slate-800 dark:bg-blue-600 hover:bg-slate-900 dark:hover:bg-blue-700 text-white"><Plus className="w-3 h-3"/> {t('إضافة', 'Add')}</Button>
                               ) : (
                                 <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> {t('مضاف', 'Added')}</span>
                               )}
                            </div>
                          </div>
                        );
                      })}
                      {filteredComps.length === 0 && <div className="col-span-1 sm:col-span-2 text-center text-slate-400 font-bold py-10">{t('لا توجد قطع مطابقة', 'No matching items')}</div>}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-lg flex flex-col h-[500px] text-slate-800 dark:text-white relative overflow-hidden border border-slate-200 dark:border-slate-800">
                  <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none"></div>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-700 relative z-10"><h3 className="text-base font-black flex items-center gap-2 text-slate-800 dark:text-slate-100"><ShoppingCart className="w-5 h-5 text-blue-500 dark:text-blue-400"/> {t('2. قطع المعسكر', '2. Camp Items')}</h3><span className="text-xs font-black bg-blue-600 text-white rounded-md px-2.5 py-1">{totalCartItems}</span></div>
                  <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3 relative z-10">
                    {cart.length === 0 ? (
                      <div className="text-center text-slate-400 dark:text-slate-500 font-bold mt-20 text-sm flex flex-col items-center"><Package className="w-16 h-16 mb-3 opacity-20"/> {t('السلة فارغة. ابدأ بإضافة القطع.', 'Cart is empty. Add items.')}</div>
                    ) : (
                      cart.map(item => (
                        <div key={getNameAr(item.component)} className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
                          <div className="flex-1 min-w-0"><p className="text-xs font-bold truncate text-slate-700 dark:text-slate-200">{displayCompName(item.component)}</p></div>
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-inner shrink-0" dir="ltr">
                            <button onClick={(e) => { e.preventDefault(); updateCartQty(getNameAr(item.component), item.quantity - 1); }} className="w-7 h-7 flex items-center justify-center bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-bold transition-colors">−</button>
                            <span className="w-7 text-center text-sm font-black text-blue-600 dark:text-blue-400">{item.quantity}</span>
                            <button onClick={(e) => { e.preventDefault(); updateCartQty(getNameAr(item.component), item.quantity + 1); }} disabled={item.quantity >= item.component.quantity} className="w-7 h-7 flex items-center justify-center bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-bold transition-colors disabled:opacity-50">+</button>
                            <button onClick={(e) => { e.preventDefault(); updateCartQty(getNameAr(item.component), 0); }} className="w-7 h-7 flex items-center justify-center hover:bg-red-500/20 text-red-400 rounded ml-1 transition-colors"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0 gap-3">
            <Button variant="outline" onClick={resetDialog} className="w-full sm:w-auto font-bold border-slate-300 dark:border-slate-700 dark:text-white h-12">{t('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.organization || (!isEditMode && cart.length === 0)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md h-12 px-8 transition-transform active:scale-95">{isEditMode ? t('حفظ التعديلات', 'Save Changes') : t('اعتماد المعسكر', 'Confirm Camp')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 📷 كاميرا مسح الباركود للمعسكرات */}
      <Dialog open={isScannerOpen} onOpenChange={v => { setIsScannerOpen(v); setManualBarcode(''); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader className="p-4 bg-slate-900 border-b border-slate-800">
            <DialogTitle className="text-xl font-black flex items-center gap-2 text-white">
              <ScanLine className="w-6 h-6 text-purple-400" /> {t('مسح / كتابة باركود الموقع', 'Scan / Type Location Barcode')}
            </DialogTitle>
          </DialogHeader>

          {/* كاميرا */}
          <div className="relative w-full aspect-square bg-black">
            {isScannerOpen && (
              <Scanner
                onScan={codes => { if (codes && codes.length > 0) processBarcode(codes[0].rawValue); }}
                onError={() => {}}
                constraints={{ facingMode: 'environment' }}
                components={{ onOff: true, torch: true, zoom: true, finder: false }}
              />
            )}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-4 border-purple-500 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
            </div>
          </div>

          {/* إدخال يدوي */}
          <div className="p-4 bg-slate-900 space-y-3">
            <p className="text-xs font-bold text-slate-400 text-center">{t('وجه الكاميرا نحو باركود البوكس أو اكتبه يدوياً', 'Scan barcode or type it manually')}</p>
            <div className="flex gap-2">
              <Input
                value={manualBarcode}
                onChange={e => setManualBarcode(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && manualBarcode.trim()) { processBarcode(manualBarcode.trim()); setManualBarcode(''); } }}
                placeholder={t('اكتب الباركود هنا...', 'Type barcode here...')}
                className="flex-1 bg-slate-800 border-slate-600 text-white placeholder-slate-500 h-11 font-mono text-sm focus:border-purple-500"
                dir="ltr"
                autoFocus={false}
              />
              <Button
                onClick={() => { if (manualBarcode.trim()) { processBarcode(manualBarcode.trim()); setManualBarcode(''); } }}
                disabled={!manualBarcode.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-11 px-5 shrink-0"
              >
                {t('بحث', 'Find')}
              </Button>
            </div>
            <Button variant="outline" onClick={() => { setIsScannerOpen(false); setManualBarcode(''); }} className="w-full font-bold bg-white dark:bg-slate-700 text-black dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 border-none h-10">
              {t('إغلاق', 'Close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🌟 نافذة منتقي الشجرة للفلترة في المعسكرات 🌟 */}
      <Dialog open={isLocPickerOpen} onOpenChange={setIsLocPickerOpen}>
         <DialogContent className="max-w-md font-sans" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-black text-blue-600"><MapPin className="w-5 h-5"/> {t('تصفية القطع حسب الموقع', 'Filter by Location')}</DialogTitle></DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto py-4 custom-scrollbar pr-2 border-y border-slate-100 dark:border-slate-800">
                {locationTree.map(loc => <FilterPickerNode key={loc.id} node={loc} />)}
            </div>
            <DialogFooter>
                <Button onClick={() => setIsLocPickerOpen(false)} className="w-full font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700">{t('إغلاق', 'Close')}</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

    </div>
  );
};

export default AdminCamps;