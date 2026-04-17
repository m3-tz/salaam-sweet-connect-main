import {useState, useEffect, useRef} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, MapPin, Package, Plus, Pencil, Trash2, Globe, Layers, Wrench, CheckCircle2, X, Home, AlignJustify, Archive, ShoppingBasket, Server, Map, List, Grid, GripVertical, ScanLine, ChevronDown, ChevronRight, ChevronLeft, Printer, Copy, TextCursorInput, ArrowUpDown, AlertCircle, Download, BarChart3, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '../../LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiUrl } from '@/lib/api';
import LocationBadge from '@/components/LocationBadge';

// 🚀 المكتبة الصاروخية الجديدة للـ QR Code
import { Scanner } from '@yudiel/react-qr-scanner';

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
  original_name_ar?: string;
  is_hidden?: boolean;
}

interface MaintenanceItem {
  id: number;
  item_name: string;
  quantity: number;
  student_name: string;
  checkout_date: string;
}


// ✅ مكون شجرة اختيار الموقع للنموذج
const LocationPickerTree = ({
  nodes, selectedIds, onToggle, getIcon, getFullPath
}: {
  nodes: StorageLocation[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  getIcon: (type: string, cls?: string) => React.ReactNode;
  getFullPath: (id: number) => string;
}) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (id: number) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const renderNode = (node: StorageLocation, depth = 0): React.ReactNode => {
    const isSelected = selectedIds.includes(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded[node.id] === true; // default collapsed

    return (
      <div key={node.id} style={{ paddingRight: depth * 16 }}>
        <div className={`flex items-center gap-2 p-2.5 rounded-xl border-2 mb-1 transition-all cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          onClick={() => onToggle(node.id)}>
          {/* expand button */}
          <button onClick={(e) => { e.stopPropagation(); toggle(node.id); }}
            className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-slate-400">
            {hasChildren ? (isExpanded ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>) : <span className="w-4"/>}
          </button>
          {/* icon */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-blue-600' : 'bg-slate-100 dark:bg-slate-800'}`}>
            {isSelected ? <CheckCircle2 className="w-4 h-4 text-white" /> : getIcon(node.type, "w-4 h-4")}
          </div>
          {/* info */}
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm truncate ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`}>
              {node.name}
              <span className="text-[10px] text-slate-400 font-normal ml-1.5">({node.type})</span>
            </p>
            {node.barcode && <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{node.barcode}</p>}
          </div>
          {isSelected && <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">✓</span>}
        </div>
        {hasChildren && isExpanded && (
          <div className="border-r-2 border-slate-100 dark:border-slate-800 mr-4 mb-1">
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (nodes.length === 0) return <div className="text-center py-10 text-slate-400 font-bold text-sm">لا توجد مواقع مسجلة</div>;
  return <div className="space-y-0.5">{nodes.map(n => renderNode(n))}</div>;
};

const AdminInventory = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'مشرف' || user?.role?.toLowerCase() === 'admin';

  const { toast } = useToast();
  const { lang, t } = useLanguage();

  const [activeTab, setActiveTab] = useState('components');

  // 📷 حالة كاميرا الـ QR
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // 📦 حالة بوب-أب نتيجة مسح الباركود
  const [isScanResultOpen, setIsScanResultOpen] = useState(false);
  const [scanResultLoc, setScanResultLoc] = useState<StorageLocation | null>(null);
  const [scanResultItems, setScanResultItems] = useState<Device[]>([]);

  // 🌟 States للمخزون
  const [components, setComponents] = useState<Device[]>([]);
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'qty_asc' | 'qty_desc' | 'low_stock'>('name');
  const [treeSearch, setTreeSearch] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string>('');
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [locSearch, setLocSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});
  const toggleNode = (id: number) => setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  const [category, setCategory] = useState('All');
  const [locationSearch, setLocationSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  // 🌟 States لإضافة/تعديل قطعة
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [formData, setFormData] = useState<Device>({ name_ar: '', name_en: '', quantity: 0, category_ar: '', category_en: '', location_ids: [], imageUrl: '', original_name_ar: '' });
  const [newCatAr, setNewCatAr] = useState('');
  const [newCatEn, setNewCatEn] = useState('');

  // 🌟 States للخريطة (WMS)
  const [flatLocations, setFlatLocations] = useState<StorageLocation[]>([]);
  const [locationTree, setLocationTree] = useState<StorageLocation[]>([]);
  const [selectedMapLoc, setSelectedMapLoc] = useState<StorageLocation | null>(null);
  const [locItems, setLocItems] = useState<Device[]>([]);

  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [isLocEditMode, setIsLocEditMode] = useState(false);
  const [editingLocId, setEditingLocId] = useState<number | null>(null);
  const [locForm, setLocForm] = useState({ name: '', type: 'Box' as LocType, parent_id: 'none', barcode: '', description: '', max_capacity: 100 });
  const [dragOverId, setDragOverId] = useState<number | null>(null);

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

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [itemsRes, maintRes, locRes] = await Promise.all([
        fetch(apiUrl('/api/items?admin=1')),
        fetch(apiUrl('/api/maintenance')),
        fetch(apiUrl('/api/admin/locations'))
      ]);

      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setComponents(d.data);
      }
      if (maintRes.ok) {
        const d = await maintRes.json();
        setMaintenanceItems(d.data);
      }
      if (locRes.ok) {
        const d = await locRes.json();
        setFlatLocations(d.data);
        setLocationTree(buildTree(d.data));
        if (selectedMapLoc) {
            const updated = d.data.find((l: StorageLocation) => l.id === selectedMapLoc.id);
            if(updated) handleSelectLocation(updated, d.data, components);
            else setSelectedMapLoc(null);
        }
      }
    } catch (error) {
      toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAllData(); }, []);

  // ── مرجع للدالة حتى لا يكون هناك stale closure في الـ listener ──────────
  const processBarcodeRef = useRef<(text: string) => void>(() => {});

  // 🎯 الدالة المركزية لمعالجة الباركود
  const processBarcodeText = (barcodeText: string) => {
      const formattedText = barcodeText.trim().toUpperCase();
      const foundLoc = flatLocations.find(l => l.barcode.toUpperCase() === formattedText);

      if (foundLoc) {
          const relevantIds = getChildIds(foundLoc.id);
          const items = components.filter(item => item.location_ids?.some(id => relevantIds.includes(id)));
          setScanResultLoc(foundLoc);
          setScanResultItems(items);
          setIsScanResultOpen(true);
      } else {
          toast({ title: t('غير معروف', 'Unknown'), description: t('هذا الـ QR غير مسجل', 'QR not registered'), variant: 'destructive' });
      }
  };

  // تحديث المرجع في كل render حتى يستخدم آخر نسخة من الدالة
  useEffect(() => { processBarcodeRef.current = processBarcodeText; });

  // ── Global USB barcode scanner listener ──────────────────────────────────
  // جهاز الباركود يكتب أحرف بسرعة عالية جداً (< 30ms بين كل حرف) ثم يضغط Enter
  // هذا الـ listener يمسك الكتابة السريعة ويمنعها من الوصول للـ inputs الثانية
  useEffect(() => {
    let buffer = '';
    let charCount = 0;
    let scanStart = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();

      if (e.key === 'Enter') {
        if (charCount >= 3) {
          const elapsed = now - scanStart;
          const avgMs   = elapsed / charCount;
          // الباركود: متوسط < 40ms لكل حرف — الإنسان: > 100ms لكل حرف
          if (avgMs < 40) {
            e.preventDefault();
            e.stopPropagation();

            // إذا كان هناك input مفوكس وليس هو حقل الباركود المخصص،
            // نمسح منه الأحرف اللي كتبها الجهاز
            const target = e.target as HTMLInputElement;
            const isBarcodeInput = target.dataset['barcodeField'] === 'true';
            if (!isBarcodeInput && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
              const cleaned = target.value.slice(0, Math.max(0, target.value.length - buffer.length));
              // نفعّل تغيير القيمة عبر React
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
              if (setter) { setter.call(target, cleaned); target.dispatchEvent(new Event('input', { bubbles: true })); }
              else         { target.value = cleaned; }
            }

            processBarcodeRef.current(buffer);
          }
        }
        buffer = ''; charCount = 0;
        if (timer) clearTimeout(timer);
        return;
      }

      // نجمع الأحرف العادية فقط
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

      if (charCount === 0) scanStart = now;
      charCount++;
      buffer += e.key;

      if (timer) clearTimeout(timer);
      // إذا توقف الجهاز > 300ms بدون Enter → ليس باركود، نصفر
      timer = setTimeout(() => { buffer = ''; charCount = 0; }, 300);
    };

    document.addEventListener('keydown', handleKeyDown, true); // capture phase
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []); // [] لأننا نستخدم ref وليس القيمة مباشرة

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

  const getFullLocationPath = (locId: number): string => {
    const currentLoc = flatLocations.find(l => l.id === locId);
    if (!currentLoc) return '';
    const path = [currentLoc.name];
    let parentId = currentLoc.parent_id;
    let depth = 0;
    while (parentId && depth < 5) {
      const parent = flatLocations.find(l => l.id === parentId);
      if (parent) { path.unshift(parent.name); parentId = parent.parent_id; }
      else { break; }
      depth++;
    }
    return path.join(' → ');
  };

  const getChildIds = (id: number, allLocs: StorageLocation[] = flatLocations): number[] => {
      const children = allLocs.filter(l => l.parent_id === id).map(l => l.id);
      let all = [id, ...children];
      children.forEach(c => { all = [...all, ...getChildIds(c, allLocs)] });
      return all;
  };

  const handleSelectLocation = (loc: StorageLocation, overrideLocs = flatLocations, overrideItems = components) => {
    setSelectedMapLoc(loc);
    const relevantIds = getChildIds(loc.id, overrideLocs);
    const itemsInThisTree = overrideItems.filter(item => item.location_ids?.some(id => relevantIds.includes(id)));
    setLocItems(itemsInThisTree);
  };

  const handleSaveItem = async (isEdit: boolean) => {
    if (!formData.name_ar || formData.name_ar.trim() === '') {
      toast({ title: t('تنبيه', 'Warning'), description: t('الرجاء إدخال اسم القطعة', 'Please enter the item name'), variant: 'destructive' });
      return;
    }
    const finalCatAr = isNewCategory && newCatAr.trim() !== '' ? newCatAr : getCatAr(formData);
    const finalCatEn = isNewCategory && newCatEn.trim() !== '' ? newCatEn : getCatEn(formData);
    const finalQty = isNaN(formData.quantity) ? 0 : formData.quantity;
    const finalData = { ...formData, quantity: finalQty, category_ar: finalCatAr, category_en: finalCatEn || finalCatAr, name_ar: getNameAr(formData), name_en: getNameEn(formData) || getNameAr(formData), original_name_ar: formData.original_name_ar, location_ids: formData.location_ids };

    try {
      const res = await fetch(apiUrl('/api/admin/items'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
        body: JSON.stringify(finalData)
      });
      if (res.ok) {
        toast({ title: t('تم الحفظ بنجاح ✅', 'Saved successfully ✅') });
        setIsAddOpen(false); setIsEditOpen(false); setIsNewCategory(false);
        setNewCatAr(''); setNewCatEn('');
        fetchAllData();
      }
    } catch (error) { toast({ title: t('خطأ', 'Error'), variant: "destructive" }); }
  };

  const handleDeleteItem = async (compName: string) => {
    setItemToDelete(compName);
    setDeleteConfirmOpen(true);
  };

  const handleToggleVisibility = async (comp: Device) => {
    const name = getNameAr(comp);
    try {
      const res = await fetch(apiUrl(`/api/admin/items/${encodeURIComponent(name)}/toggle-visibility`), {
        method: 'PUT',
        headers: { 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
      });
      const d = await res.json();
      if (res.ok) {
        setComponents(prev => prev.map(c => getNameAr(c) === name ? { ...c, is_hidden: d.is_hidden } : c));
        toast({
          title: d.is_hidden
            ? t('تم الإخفاء 🙈', 'Hidden 🙈')
            : t('تم الإظهار 👁️', 'Visible 👁️'),
          description: d.is_hidden
            ? t(`"${name}" مخفية عن الطلاب`, `"${name}" hidden from students`)
            : t(`"${name}" ظاهرة للطلاب`, `"${name}" visible to students`),
        });
      } else {
        toast({ title: t('خطأ', 'Error'), description: d.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' });
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/items/${encodeURIComponent(itemToDelete)}`), {
        method: 'DELETE', headers: { 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') }
      });
      if (res.ok) { toast({ title: t('تم الحذف 🗑️', 'Deleted 🗑️') }); fetchAllData(); }
    } catch { toast({ title: t('خطأ', 'Error'), variant: "destructive" }); }
    finally { setDeleteConfirmOpen(false); setItemToDelete(''); }
  };

  const handleResolveMaintenance = async (loanId: number, action: 'repaired' | 'scrapped', itemName: string, qty: number) => {
    if (!confirm(action === 'repaired' ? t('تأكيد الإصلاح؟', 'Confirm repair?') : t('تأكيد الإتلاف؟', 'Confirm scrap?'))) return;
    try {
      const res = await fetch(apiUrl(`/api/maintenance/resolve/${loanId}`), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
        body: JSON.stringify({ action, itemName, quantity: qty })
      });
      if (res.ok) { toast({ title: t('تمت العملية ✅', 'Done ✅') }); fetchAllData(); }
    } catch (err) { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const openEdit = (comp: Device) => {
    setFormData({ ...comp, original_name_ar: getNameAr(comp), name_ar: getNameAr(comp), name_en: getNameEn(comp), category_ar: getCatAr(comp), category_en: getCatEn(comp), location_ids: comp.location_ids || [] });
    setIsNewCategory(false); setIsAddOpen(false); setIsEditOpen(true); setFormStep(1); setLocSearch('');
  };

  const openDuplicate = (comp: Device) => {
    setFormData({ ...comp, name_ar: getNameAr(comp) + ' (نسخة)', name_en: getNameEn(comp) + ' (Copy)', category_ar: getCatAr(comp), category_en: getCatEn(comp), location_ids: comp.location_ids || [], original_name_ar: '' });
    setIsNewCategory(false); setIsEditOpen(false); setIsAddOpen(true); setFormStep(1); setLocSearch('');
  };

  const getLocationStats = (locId: number) => {
      let totalQty = 0; let hasShortage = false;
      const relevantIds = getChildIds(locId);
      const relevantItems = components.filter(item => item.location_ids?.some(id => relevantIds.includes(id)));
      relevantItems.forEach(item => { totalQty += item.quantity; if (item.quantity < 5) hasShortage = true; });
      return { totalQty, hasShortage };
  };

  const isDescendant = (draggedId: number, targetId: number) => {
    let current = flatLocations.find(l => l.id === targetId);
    while (current) {
        if (current.parent_id === draggedId) return true;
        current = flatLocations.find(l => l.id === current?.parent_id);
    }
    return false;
  };

  const handleDropLocation = async (e: React.DragEvent, targetId: number | null) => {
      e.preventDefault(); setDragOverId(null);
      const draggedId = parseInt(e.dataTransfer.getData('loc_id'));
      if (!draggedId || draggedId === targetId || (targetId && isDescendant(draggedId, targetId))) {
          toast({ title: t('حركة غير صالحة', 'Invalid move'), variant: 'destructive' }); return;
      }
      const draggedLoc = flatLocations.find(l => l.id === draggedId);
      if (!draggedLoc) return;

      try {
        const res = await fetch(apiUrl(`/api/admin/locations/${draggedId}`), {
          method: 'PUT', headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
          body: JSON.stringify({ ...draggedLoc, parent_id: targetId === null ? 'none' : targetId })
        });
        if (res.ok) { toast({ title: t('تم النقل 🚚', 'Moved 🚚') }); fetchAllData(); }
      } catch (error) { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const handleSaveLocation = async () => {
    if (!locForm.name || !locForm.type) return;
    const url = isLocEditMode && editingLocId ? apiUrl(`/api/admin/locations/${editingLocId}`) : apiUrl('/api/admin/locations');
    const method = isLocEditMode ? 'PUT' : 'POST';

    // ✅ حساب parent_id بشكل صحيح
    const parsedParent = locForm.parent_id === 'none' || !locForm.parent_id
      ? null
      : parseInt(locForm.parent_id);
    const parentId = (parsedParent !== null && isNaN(parsedParent)) ? null : parsedParent;

    const payload = {
      name: locForm.name,
      type: locForm.type,
      parent_id: parentId,
      barcode: locForm.barcode || `LOC-${Date.now().toString().slice(-6)}`,
      description: locForm.description || '',
      max_capacity: locForm.max_capacity || 100
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: t('تم الحفظ ✅', 'Saved ✅') });
        setIsLocModalOpen(false);
        fetchAllData();
      } else {
        toast({ title: t('خطأ في الحفظ', 'Save Error'), description: data.message || t('تحقق من البيانات', 'Check your data'), variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' });
    }
  };

  const handleDeleteLocation = async (locId: number) => {
    if (!confirm(t('تأكيد الحذف؟', 'Confirm delete?'))) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/locations/${locId}`), { method: 'DELETE', headers: { 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') } });
      if (res.ok) { toast({ title: t('تم الحذف 🗑️', 'Deleted 🗑️') }); if (selectedMapLoc?.id === locId) setSelectedMapLoc(null); fetchAllData(); }
      else { const data = await res.json(); toast({ title: t('غير مسموح', 'Not allowed'), description: data.message, variant: 'destructive' }); }
    } catch (error) { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const printBarcodeLabel = (loc: StorageLocation) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${loc.barcode}`;
    const fullPath = getFullLocationPath(loc.id);

    const htmlContent = `
      <html>
        <head>
          <title>Print Label - ${loc.name}</title>
          <style>
            @page { margin: 0; size: auto; }
            body { font-family: Arial, sans-serif; text-align: center; margin: 0; padding: 1mm; display: flex; align-items: center; justify-content: center; height: 22mm; background-color: white; color: black; overflow: hidden; }
            .label-box { display: flex; align-items: center; justify-content: center; gap: 3mm; width: 100%; padding: 0 2mm; }
            .info { display: flex; flex-direction: column; align-items: flex-start; text-align: left; }
            h2 { margin: 0 0 3px 0; font-size: 11px; font-weight: 900; line-height: 1.2; max-width: 35mm; word-wrap: break-word; }
            p { margin: 0; font-size: 10px; font-family: monospace; font-weight: bold; color: #333; }
            img { width: 16mm; height: 16mm; object-fit: contain; }
          </style>
        </head>
        <body>
          <div class="label-box">
             <img src="${qrUrl}" alt="QR" />
             <div class="info">
                 <h2>${fullPath.replace(/ ➔ /g, '<br>➔ ')}</h2>
                 <p>${loc.barcode}</p>
             </div>
          </div>
          <script>
             setTimeout(() => { window.print(); window.close(); }, 1000);
          </script>
        </body>
      </html>`;
    printWindow.document.write(htmlContent); printWindow.document.close();
  };

  const openLocEdit = (loc: StorageLocation) => {
      setIsLocEditMode(true); setEditingLocId(loc.id);
      setLocForm({ name: loc.name, type: loc.type, parent_id: loc.parent_id ? loc.parent_id.toString() : 'none', barcode: loc.barcode || '', description: loc.description || '', max_capacity: loc.max_capacity || 100 });
      setIsLocModalOpen(true);
  };

  const openLocAdd = () => {
      setIsLocEditMode(false); setEditingLocId(null);
      setLocForm({ name: '', type: 'Box', parent_id: 'none', barcode: '', description: '', max_capacity: 100 });
      setIsLocModalOpen(true);
  };

  const allCategoriesAr = ['All', ...Array.from(new Set(components.map(c => getCatAr(c))))];
  const allCategoriesEn = ['All', ...Array.from(new Set(components.map(c => getCatEn(c))))];

  const hiddenCount = components.filter(c => c.is_hidden).length;

  const filteredItems = components.filter(c => {
    const searchLower = search.toLowerCase();
    const matchSearch = getNameAr(c).toLowerCase().includes(searchLower) || getNameEn(c).toLowerCase().includes(searchLower);
    const matchCat = category === 'All' || getCatAr(c) === category || getCatEn(c) === category;
    const matchHidden = showHidden ? true : !c.is_hidden;
    return matchSearch && matchCat && matchHidden;
  }).sort((a, b) => {
    if (sortBy === 'qty_asc') return a.quantity - b.quantity;
    if (sortBy === 'qty_desc') return b.quantity - a.quantity;
    if (sortBy === 'low_stock') return (a.quantity < 5 ? -1 : 1);
    return (lang === 'ar' ? getNameAr(a) : getNameEn(a)).localeCompare(lang === 'ar' ? getNameAr(b) : getNameEn(b));
  });

  const exportInventoryCSV = () => {
    const headers = [t('اسم القطعة (عربي)', 'Name (AR)'), t('الاسم (إنجليزي)', 'Name (EN)'), t('التصنيف', 'Category'), t('الكمية', 'Qty'), t('الموقع', 'Location')];
    const rows = filteredItems.map(c => [
      getNameAr(c), getNameEn(c),
      lang === 'ar' ? getCatAr(c) : getCatEn(c),
      c.quantity,
      c.location_ids?.map(id => getFullLocationPath(id)).join(' | ') || c.location || ''
    ]);
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${t('المخزون', 'Inventory')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    toast({ title: t('تم التصدير ✅', 'Exported ✅') });
  };

  const printInventory = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const rows = filteredItems.map(c => `<tr><td>${displayCompName(c)}</td><td>${lang === 'ar' ? getCatAr(c) : getCatEn(c)}</td><td style="text-align:center;font-weight:900;color:${c.quantity === 0 ? '#dc2626' : c.quantity < 5 ? '#f97316' : '#16a34a'}">${c.quantity}</td><td>${c.location_ids?.map(id => getFullLocationPath(id)).join(' | ') || c.location || '—'}</td></tr>`).join('');
    printWindow.document.write(`<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><title>${t('تقرير المخزون', 'Inventory Report')}</title><style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:8px 12px;font-size:13px}th{background:#f8fafc;font-weight:900}h1{color:#1d4ed8}@media print{body{padding:0}}</style></head><body><h1>📦 ${t('تقرير المخزون', 'Inventory Report')} — ${new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}</h1><table><thead><tr><th>${t('اسم القطعة', 'Item')}</th><th>${t('التصنيف', 'Category')}</th><th>${t('الكمية', 'Qty')}</th><th>${t('الموقع', 'Location')}</th></tr></thead><tbody>${rows}</tbody></table><script>setTimeout(()=>{window.print();window.close();},500);</script></body></html>`);
    printWindow.document.close();
  };

  // ✅ بحث عكسي محسن — يعمل مع اسم القطعة والمكان
  const normalize = (s: string) => s.toLowerCase().replace(/[أإآا]/g, 'ا').replace(/[ةت]/g, 'ت').replace(/ى/g, 'ي').trim();
  const reverseByItem = (q: string) => q.trim() === '' ? [] : components.filter(c =>
    normalize(getNameAr(c)).includes(normalize(q)) ||
    normalize(getNameEn(c)).includes(normalize(q)) ||
    normalize(getCatAr(c)).includes(normalize(q)) ||
    normalize(getCatEn(c)).includes(normalize(q))
  );
  const reverseByLocation = (q: string) => {
    if (q.trim() === '') return [];
    const nq = normalize(q);
    const matchedLocs = flatLocations.filter(l =>
      normalize(l.name).includes(nq) ||
      normalize(l.barcode || '').includes(nq) ||
      normalize(getFullLocationPath(l.id)).includes(nq)
    );
    if (matchedLocs.length === 0) return [];
    const matchedIds = matchedLocs.flatMap(l => getChildIds(l.id));
    return components.filter(c => c.location_ids?.some(id => matchedIds.includes(id)));
  };
  const reverseFiltered = components.filter(c => {
      if(locationSearch.trim() === '') return false;
      return (c.location || '').toLowerCase().includes(locationSearch.toLowerCase());
  });

  const selectedMapChildren = selectedMapLoc ? flatLocations.filter(l => l.parent_id === selectedMapLoc.id) : [];

  const renderDeviceTable = (data: Device[]) => (
    <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in">
      <table className="w-full text-sm text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
          <tr>
            <th className="p-4 font-bold">{t('صورة', 'Image')}</th>
            <th className="p-4 font-bold">{t('اسم القطعة', 'Name')}</th>
            <th className="p-4 font-bold">{t('التصنيف', 'Category')}</th>
            <th className="p-4 font-bold">{t('المواقع', 'Locations')}</th>
            <th className="p-4 font-bold text-center">{t('الكمية', 'Qty')}</th>
            {isSuperAdmin && <th className="p-4 font-bold text-center">{t('إجراءات', 'Actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? <tr><td colSpan={6} className="text-center p-8 font-bold text-slate-400">{t('لا توجد قطع مطابقة', 'No matching items')}</td></tr> : null}
          {data.map((c, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="p-3"><div className="w-12 h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-1 flex items-center justify-center"><img src={c.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png'} className={`max-w-full max-h-full object-contain ${c.quantity === 0 ? 'grayscale opacity-50' : ''}`} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }} /></div></td>
              <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{displayCompName(c)}</td>
              <td className="p-3 text-xs text-slate-500 dark:text-slate-400 font-bold"><Layers className="w-3 h-3 inline mr-1 text-blue-500"/>{lang === 'ar' ? getCatAr(c) : getCatEn(c)}</td>
              <td className="p-3">
                <LocationBadge
                  location={
                    c.location_ids?.length
                      ? c.location_ids.map(id => getFullLocationPath(id)).filter(Boolean).join(' | ')
                      : c.location
                  }
                  small
                />
              </td>
              <td className="p-3 text-center font-black text-lg"><span className={c.quantity === 0 ? 'text-red-500' : c.quantity < 5 ? 'text-orange-500' : 'text-emerald-500'}>{c.quantity}</span></td>
              {isSuperAdmin && (
                <td className="p-3 text-center space-x-1 space-x-reverse whitespace-nowrap">
                   <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 h-8 w-8"><Pencil className="w-3.5 h-3.5"/></Button>
                   <Button variant="ghost" size="icon" title={c.is_hidden ? t('إظهار','Show') : t('إخفاء','Hide')} onClick={() => handleToggleVisibility(c)} className={`h-8 w-8 ${c.is_hidden ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{c.is_hidden ? <Eye className="w-3.5 h-3.5"/> : <EyeOff className="w-3.5 h-3.5"/>}</Button>
                   <Button variant="ghost" size="icon" onClick={() => openDuplicate(c)} className="text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 h-8 w-8"><Copy className="w-3.5 h-3.5"/></Button>
                   <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(getNameAr(c))} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 h-8 w-8"><Trash2 className="w-3.5 h-3.5"/></Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderDeviceCards = (data: Device[]) => {
    if (loading) return <div className="text-center py-20 font-bold dark:text-slate-300">{t('جاري التحميل...', 'Loading...')}</div>;
    if (data.length === 0) return <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm transition-colors"><Package className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" /><p className="text-xl font-black text-slate-600 dark:text-slate-300">{t('لا توجد قطع', 'No items found')}</p></div>;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
        {data.map((c, index) => {
          const isOutOfStock = c.quantity === 0;
          return (
            <Card key={index} className={`overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-slate-200 dark:border-slate-800 group bg-white dark:bg-slate-900 flex flex-col h-full rounded-2xl relative ${c.is_hidden ? 'opacity-60 border-dashed border-slate-400 dark:border-slate-600' : ''}`}>
              <div className={`absolute top-0 left-0 w-full h-1.5 z-20 ${c.is_hidden ? 'bg-slate-400' : isOutOfStock ? 'bg-red-500' : c.quantity < 5 ? 'bg-orange-400' : 'bg-emerald-500'}`}></div>
              <div className="aspect-[4/3] bg-slate-50 dark:bg-slate-800/50 relative flex items-center justify-center border-b border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className={`absolute top-3 ${lang === 'ar' ? 'right-3' : 'left-3'} px-2.5 py-1 rounded-md text-[10px] font-black border dark:border-slate-700 shadow-sm z-10 bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 uppercase flex items-center gap-1.5`}><Layers className="w-3 h-3 text-blue-500 dark:text-blue-400"/> {lang === 'ar' ? getCatAr(c) : getCatEn(c)}</div>
                {c.is_hidden && (
                  <div className={`absolute top-3 ${lang === 'ar' ? 'left-3' : 'right-3'} px-2 py-1 rounded-md text-[10px] font-black bg-slate-800/90 text-white z-10 flex items-center gap-1`}>
                    <EyeOff className="w-3 h-3"/>{t('مخفي', 'Hidden')}
                  </div>
                )}
                <img src={c.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png'} className={`object-contain w-full h-full p-8 group-hover:scale-110 transition-transform ${isOutOfStock || c.is_hidden ? 'grayscale opacity-50' : ''}`} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }} />
                {isOutOfStock && !c.is_hidden && <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-black/40 backdrop-blur-[1px] z-10"><span className="bg-red-600 text-white font-black px-4 py-1.5 rounded-full text-sm rotate-[-10deg] shadow-lg border-2 border-white dark:border-slate-900">{t('نفدت الكمية', 'Out of Stock')}</span></div>}
              </div>
              <CardContent className="p-5 flex-1 flex flex-col">
                <h3 className="font-black text-slate-800 dark:text-white text-lg line-clamp-2 mb-4">{displayCompName(c)}</h3>
                <div className="mt-auto space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col min-w-0 w-full pr-2">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-1 flex items-center gap-1"><MapPin className="w-3 h-3"/> {t('المواقع', 'Locations')}</span>
                      <LocationBadge
                        location={
                          c.location_ids?.length
                            ? c.location_ids.map(id => getFullLocationPath(id)).filter(Boolean).join(' | ')
                            : c.location
                        }
                        small
                      />
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                       <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-1">{t('الكمية', 'Qty')}</span>
                       <span className={`font-black text-2xl leading-none ${isOutOfStock ? 'text-red-500 dark:text-red-400' : c.quantity < 5 ? 'text-orange-500 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{c.quantity}</span>
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 transition-colors">
                      <Button variant="outline" size="sm" onClick={() => openEdit(c)} className="flex-1 gap-1.5 h-9 font-bold text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/30"><Pencil className="w-3.5 h-3.5"/> <span className="hidden sm:inline">{t('تعديل', 'Edit')}</span></Button>
                      <Button variant="outline" size="icon" title={c.is_hidden ? t('إظهار للطلاب','Show to students') : t('إخفاء من الطلاب','Hide from students')} onClick={() => handleToggleVisibility(c)} className={`h-9 w-9 shrink-0 ${c.is_hidden ? 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30' : 'text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{c.is_hidden ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}</Button>
                      <Button variant="outline" size="icon" onClick={() => openDuplicate(c)} className="h-9 w-9 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 shrink-0"><Copy className="w-4 h-4"/></Button>
                      <Button variant="outline" size="icon" onClick={() => handleDeleteItem(getNameAr(c))} className="h-9 w-9 text-red-500 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/30 shrink-0"><Trash2 className="w-4 h-4"/></Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const typeColors: Record<string, string> = {
    Room: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    Zone: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    Cabinet: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    Rack: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
    Shelf: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    Drawer: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    Box: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    Bin: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800',
  };

  const TreeNode = ({ node, depth = 0 }: { node: StorageLocation, depth?: number }) => {
    const expanded = !!expandedNodes[node.id];
    const [hovered, setHovered] = useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const stats = getLocationStats(node.id);
    const fillPct = Math.min(Math.round((stats.totalQty / (node.max_capacity || 100)) * 100), 100);
    const fillColor = fillPct > 90 ? 'bg-red-500' : fillPct > 60 ? 'bg-orange-400' : 'bg-emerald-500';
    const typeColor = typeColors[node.type] || 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700';
    const isSelected = selectedMapLoc?.id === node.id;
    const isDropTarget = dragOverId === node.id;

    return (
      <div
        style={{ marginRight: lang === 'ar' ? `${depth * 14}px` : 0, marginLeft: lang === 'ar' ? 0 : `${depth * 14}px` }}
        onDragOver={(e) => { e.preventDefault(); setDragOverId(node.id); }}
        onDragLeave={() => setDragOverId(null)}
        onDrop={(e) => handleDropLocation(e, node.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          draggable
          onDragStart={(e) => e.dataTransfer.setData('loc_id', node.id.toString())}
          onClick={() => handleSelectLocation(node)}
          className={`flex items-center gap-2 p-2 rounded-xl mb-1 cursor-pointer transition-all border ${
            isSelected
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-700 shadow-sm'
              : isDropTarget
              ? 'border-dashed border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10'
              : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          {/* expand toggle */}
          <button onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}
            className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            {hasChildren
              ? (expanded ? <ChevronDown className="w-3.5 h-3.5"/> : <ChevronRight className={`w-3.5 h-3.5 ${lang==='ar'?'rotate-180':''}`}/>)
              : <span className="w-3.5"/>}
          </button>

          {/* type icon colored */}
          <div className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${typeColor}`}>
            {getIcon(node.type, "w-3.5 h-3.5")}
          </div>

          {/* name + type badge */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`font-bold text-sm truncate ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`}>{node.name}</span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border flex-shrink-0 ${typeColor}`}>{node.type}</span>
            </div>
            {node.parent_id && depth === 0 && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{getFullLocationPath(node.id)}</p>
            )}
            {/* fill bar for small units */}
            {['Box','Bin','Drawer','Shelf'].includes(node.type) && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${fillColor}`} style={{width: `${fillPct}%`}}/>
                </div>
                <span className={`text-[9px] font-bold flex-shrink-0 ${fillPct > 90 ? 'text-red-500' : fillPct > 60 ? 'text-orange-500' : 'text-slate-400'}`}>{fillPct}%</span>
              </div>
            )}
          </div>

          {/* item count badge */}
          {stats.totalQty > 0 && (
            <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full flex-shrink-0 border border-slate-200 dark:border-slate-700">
              {stats.totalQty}
            </span>
          )}

          {/* ✅ زر إضافة موقع فرعي */}
          {isSuperAdmin && hovered && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsLocEditMode(false); setEditingLocId(null);
                setLocForm({ name: '', type: 'Box', parent_id: node.id.toString(), barcode: '', description: '', max_capacity: 100 });
                setIsLocModalOpen(true);
              }}
              className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white flex items-center justify-center flex-shrink-0 transition-colors"
              title={t('إضافة موقع فرعي', 'Add sub-location')}
            >
              <Plus className="w-3.5 h-3.5"/>
            </button>
          )}

          <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600 cursor-grab opacity-40 flex-shrink-0" />
        </div>

        {expanded && hasChildren && (
          <div className={`border-r-2 border-slate-100 dark:border-slate-800 ${lang === 'ar' ? 'mr-3.5' : 'ml-3.5'} mb-1`}>
            {node.children!.map(child => <TreeNode key={child.id} node={child} depth={depth + 1} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 font-sans pb-10 transition-colors" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 border-b border-slate-200 dark:border-slate-800 pb-4 transition-colors">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Server className="w-7 h-7 text-blue-600" /> {t('إدارة المعمل والمخزون', 'Lab & Inventory System')}
          </h1>
          {/* ✅ badge مخزون منخفض */}
          {(() => {
            const lowCount = components.filter(c => c.quantity > 0 && c.quantity < 5).length;
            const outCount = components.filter(c => c.quantity === 0).length;
            return (
              <>
                {lowCount > 0 && (
                  <button onClick={() => { setActiveTab('components'); setSortBy('low_stock'); }}
                    className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 text-xs font-black px-3 py-1.5 rounded-full shadow-sm hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors">
                    <AlertCircle className="w-3.5 h-3.5" /> {lowCount} {t('منخفضة', 'Low Stock')}
                  </button>
                )}
                {outCount > 0 && (
                  <button onClick={() => { setActiveTab('components'); setSortBy('qty_asc'); }}
                    className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-black px-3 py-1.5 rounded-full shadow-sm animate-pulse hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                    <Package className="w-3.5 h-3.5" /> {outCount} {t('نفدت', 'Out of Stock')}
                  </button>
                )}
              </>
            );
          })()}
        </div>

        {isSuperAdmin && (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {/* 📝 حقل الإدخال السريع للباركود */}
            <div className="relative flex-1 sm:flex-none">
              <TextCursorInput className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400`} />
              <Input
                data-barcode-field="true"
                placeholder={t('أدخل الباركود LOC-', 'Enter LOC-')}
                className={`w-full sm:w-48 h-10 font-bold bg-white dark:bg-slate-950 border-purple-200 dark:border-purple-900/50 text-purple-700 dark:text-purple-400 transition-colors ${lang === 'ar' ? 'pr-9 text-right' : 'pl-9 text-left'}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation(); // لا تترك الـ global listener يعيد المعالجة
                    processBarcodeText(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>

            {/* 📷 الزر الجديد اللي يفتح نافذة الكاميرا للـ QR */}
            <Button onClick={() => setIsScannerOpen(true)} variant="outline" className="font-bold gap-2 shadow-sm border-purple-200 dark:border-purple-900/50 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 h-10 flex-1 sm:flex-none transition-colors">
              <ScanLine className="w-4 h-4" /> <span className="hidden sm:inline">{t('مسح QR', 'Scan QR')}</span>
            </Button>

            <Button onClick={() => { setIsLocEditMode(false); setEditingLocId(null); setLocForm({ name: '', type: 'Box', parent_id: 'none', barcode: '', description: '', max_capacity: 100 }); setIsLocModalOpen(true); }} variant="outline" className="font-bold gap-2 shadow-sm border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 h-10 flex-1 sm:flex-none transition-colors">
              <Map className="w-4 h-4" /> <span className="hidden sm:inline">{t('موقع', 'Location')}</span>
            </Button>
            <Button onClick={() => { setFormData({name_ar:'', name_en:'', quantity:0, category_ar:'عام', category_en:'General', location_ids: [], imageUrl:'', original_name_ar: ''}); setIsNewCategory(false); setIsAddOpen(true); setFormStep(1); setLocSearch(''); }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-md active:scale-95 h-10 flex-1 sm:flex-none transition-colors">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t('قطعة', 'Item')}</span>
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <TabsList className="mb-6 bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 p-1.5 rounded-xl flex flex-wrap gap-1 h-auto transition-colors">
          <TabsTrigger value="components" className="gap-2 rounded-lg px-5 py-2.5 text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm dark:text-slate-400 transition-colors"><Package className="w-4 h-4" /> {t('قائمة المخزون', 'Inventory List')}</TabsTrigger>
          <TabsTrigger value="locations-map" className="gap-2 rounded-lg px-5 py-2.5 text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm dark:text-slate-400 transition-colors"><Map className="w-4 h-4" /> {t('خريطة المعمل (WMS)', 'Lab Map (WMS)')}</TabsTrigger>
          <TabsTrigger value="reverse-search" className="gap-2 rounded-lg px-5 py-2.5 text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-teal-700 dark:data-[state=active]:text-teal-400 data-[state=active]:shadow-sm dark:text-slate-400 transition-colors"><MapPin className="w-4 h-4" /> {t('البحث العكسي', 'Reverse Search')}</TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-2 rounded-lg px-5 py-2.5 text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:shadow-sm dark:text-slate-400 transition-colors">
            <Wrench className="w-4 h-4" /> {t('الصيانة', 'Maintenance')}
            {maintenanceItems.length > 0 && <span className="bg-orange-500 text-white px-2 py-0.5 rounded-md text-[10px] shadow-sm animate-pulse">{maintenanceItems.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="components" className="space-y-4">

          {/* ✅ إحصائيات سريعة */}
          {(() => {
            const totalItems = components.length;
            const totalQty = components.reduce((s, c) => s + c.quantity, 0);
            const outOfStock = components.filter(c => c.quantity === 0).length;
            const lowStock = components.filter(c => c.quantity > 0 && c.quantity < 5).length;
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0"><BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400"/></div>
                  <div><p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{t('إجمالي القطع', 'Total Items')}</p><p className="text-2xl font-black text-slate-800 dark:text-white">{totalItems}</p></div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0"><Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400"/></div>
                  <div><p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{t('مجموع الكميات', 'Total Qty')}</p><p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{totalQty}</p></div>
                </div>
                <div onClick={() => { setSortBy('low_stock'); setSearch(''); }} className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm flex items-center gap-3 cursor-pointer hover:-translate-y-0.5 transition-all ${lowStock > 0 ? 'border-orange-300 dark:border-orange-800 ring-2 ring-orange-100 dark:ring-orange-900/30' : 'border-slate-200 dark:border-slate-800'}`}>
                  <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0"><AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400"/></div>
                  <div><p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{t('مخزون منخفض', 'Low Stock')}</p><p className={`text-2xl font-black ${lowStock > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-300 dark:text-slate-600'}`}>{lowStock}</p></div>
                </div>
                <div onClick={() => { setSortBy('qty_asc'); setSearch(''); }} className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm flex items-center gap-3 cursor-pointer hover:-translate-y-0.5 transition-all ${outOfStock > 0 ? 'border-red-300 dark:border-red-800 ring-2 ring-red-100 dark:ring-red-900/30' : 'border-slate-200 dark:border-slate-800'}`}>
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0"><Package className="w-5 h-5 text-red-600 dark:text-red-400"/></div>
                  <div><p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{t('نفدت', 'Out of Stock')}</p><p className={`text-2xl font-black ${outOfStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-300 dark:text-slate-600'}`}>{outOfStock}</p></div>
                </div>
              </div>
            );
          })()}

          {/* ✅ شريط البحث والفلاتر والأدوات */}
          <div className="flex flex-col sm:flex-row justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
            <div className="flex flex-1 gap-2 flex-wrap">
               <div className="relative flex-1 min-w-[160px]">
                 <Search className={`absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500`} />
                 <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('ابحث عن قطعة...', 'Search for an item...')} className={`${lang === 'ar' ? 'pr-12' : 'pl-12'} bg-slate-50 dark:bg-slate-950 dark:text-white border-slate-200 dark:border-slate-800 h-11 text-base font-medium rounded-xl transition-colors`} />
               </div>
               <Select value={category} onValueChange={setCategory}>
                   <SelectTrigger className="w-36 bg-slate-50 dark:bg-slate-950 dark:text-white border-slate-200 dark:border-slate-800 h-11 font-bold rounded-xl transition-colors" dir={lang === 'ar' ? 'rtl' : 'ltr'}><SelectValue placeholder={t('الكل', 'All')} /></SelectTrigger>
                   <SelectContent className="dark:bg-slate-900 dark:border-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                     <SelectItem value="All" className="font-bold dark:text-white">{t('الكل', 'All')}</SelectItem>
                     {(lang === 'ar' ? allCategoriesAr : allCategoriesEn).filter(c => c !== 'All').map(cat => <SelectItem key={cat} value={cat} className="dark:text-white">{cat}</SelectItem>)}
                   </SelectContent>
               </Select>
               {/* ✅ فرز */}
               <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                 <SelectTrigger className="w-36 bg-slate-50 dark:bg-slate-950 dark:text-white border-slate-200 dark:border-slate-800 h-11 font-bold rounded-xl transition-colors" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                   <ArrowUpDown className="w-4 h-4 mr-1 text-slate-400 flex-shrink-0" /><SelectValue />
                 </SelectTrigger>
                 <SelectContent className="dark:bg-slate-900 dark:border-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                   <SelectItem value="name" className="dark:text-white">{t('أبجدي', 'A-Z')}</SelectItem>
                   <SelectItem value="qty_desc" className="dark:text-white">{t('الأعلى كمية', 'Highest Qty')}</SelectItem>
                   <SelectItem value="qty_asc" className="dark:text-white">{t('الأقل كمية', 'Lowest Qty')}</SelectItem>
                   <SelectItem value="low_stock" className="text-orange-600 dark:text-orange-400 font-bold">{t('مخزون منخفض أولاً', 'Low Stock First')}</SelectItem>
                 </SelectContent>
               </Select>
            </div>
            <div className="flex gap-2 flex-wrap">
               {/* ✅ زر المخفية */}
               {hiddenCount > 0 && isSuperAdmin && (
                 <Button variant="outline" onClick={() => setShowHidden(p => !p)}
                   className={`gap-1.5 font-bold h-11 px-3 transition-colors ${showHidden ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                   {showHidden ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                   <span className="text-xs">{showHidden ? t('إخفاء المخفية','Hide hidden') : t('إظهار المخفية','Show hidden')} ({hiddenCount})</span>
                 </Button>
               )}
               {/* ✅ تصدير وطباعة */}
               <Button variant="outline" onClick={exportInventoryCSV} className="gap-1.5 font-bold h-11 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 px-3">
                 <Download className="w-4 h-4"/>
               </Button>
               <Button variant="outline" onClick={printInventory} className="gap-1.5 font-bold h-11 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 px-3">
                 <Printer className="w-4 h-4"/>
               </Button>
               <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                 <Button variant="ghost" size="icon" onClick={() => setViewMode('grid')} className={`h-9 w-10 rounded-lg ${viewMode === 'grid' ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}><Grid className="w-4 h-4"/></Button>
                 <Button variant="ghost" size="icon" onClick={() => setViewMode('table')} className={`h-9 w-10 rounded-lg ${viewMode === 'table' ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}><List className="w-4 h-4"/></Button>
               </div>
            </div>
          </div>

          {/* ✅ Skeleton Loading */}
          {loading ? (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-2"}>
              {[...Array(8)].map((_, i) => (
                viewMode === 'grid' ? (
                  <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-pulse">
                    <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800" />
                    <div className="p-5 space-y-3">
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                      <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded w-full mt-4" />
                    </div>
                  </div>
                ) : (
                  <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 animate-pulse flex gap-4">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-md flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4" />
                    </div>
                  </div>
                )
              ))}
            </div>
          ) : (viewMode === 'grid' ? renderDeviceCards(filteredItems) : renderDeviceTable(filteredItems))}
        </TabsContent>

        <TabsContent value="locations-map" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 rounded-2xl border-slate-200 dark:border-slate-800 dark:bg-slate-900 shadow-sm h-[700px] flex flex-col overflow-hidden transition-colors"
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(0); }} onDragLeave={() => setDragOverId(null)} onDrop={(e) => handleDropLocation(e, null)}>
              <div className={`p-4 border-b border-slate-100 dark:border-slate-800 transition-colors ${dragOverId === 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-50 dark:bg-slate-950'}`}>
                 <h3 className="font-black text-slate-700 dark:text-slate-200 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-500 dark:text-blue-400"/> {t('هيكل المعمل (الجذر)', 'Lab Root Structure')}</h3>
                 <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1">{t('أفلت هنا لفك ارتباط الموقع', 'Drop here to make independent')}</p>
              </div>
              {/* ✅ بحث في الشجرة */}
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="relative">
                  <Search className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                  <Input
                    value={treeSearch}
                    onChange={e => setTreeSearch(e.target.value)}
                    placeholder={t('ابحث في المواقع...', 'Search locations...')}
                    className={`h-9 text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white ${lang === 'ar' ? 'pr-9' : 'pl-9'}`}
                  />
                  {treeSearch && <button onClick={() => setTreeSearch('')} className={`absolute ${lang === 'ar' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600`}><X className="w-3.5 h-3.5"/></button>}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {loading ? (
                  <div className="space-y-2 animate-pulse p-2">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" style={{width: `${90 - i*5}%`}} />)}
                  </div>
                ) : flatLocations.length === 0 ? (
                  <div className="text-center text-slate-400 dark:text-slate-500 font-bold py-20">{t('لا توجد مواقع مسجلة', 'No locations registered')}</div>
                ) : treeSearch ? (
                  // نتائج البحث المسطحة
                  <div className="space-y-1">
                    {flatLocations.filter(l => l.name.toLowerCase().includes(treeSearch.toLowerCase()) || l.barcode.toLowerCase().includes(treeSearch.toLowerCase())).map(loc => (
                      <div key={loc.id} onClick={() => { handleSelectLocation(loc); setTreeSearch(''); }}
                        className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all border-2 ${selectedMapLoc?.id === loc.id ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        {getIcon(loc.type)}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{loc.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{getFullLocationPath(loc.id)}</p>
                        </div>
                      </div>
                    ))}
                    {flatLocations.filter(l => l.name.toLowerCase().includes(treeSearch.toLowerCase())).length === 0 && (
                      <p className="text-center text-slate-400 font-bold py-8 text-sm">{t('لا نتائج', 'No results')}</p>
                    )}
                  </div>
                ) : locationTree.map(loc => <TreeNode key={loc.id} node={loc} />)}
              </div>
            </Card>

            <Card className="lg:col-span-2 rounded-2xl border-slate-200 dark:border-slate-800 dark:bg-slate-900 shadow-sm h-[700px] flex flex-col overflow-hidden relative transition-colors">
              {!selectedMapLoc ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-50">
                  <Map className="w-24 h-24 text-slate-300 dark:text-slate-600 mb-4" />
                  <h3 className="text-2xl font-black text-slate-500 dark:text-slate-400">{t('حدد موقعاً من الخريطة', 'Select a location from map')}</h3>
                  <p className="text-sm font-bold text-slate-400 dark:text-slate-500 mt-2">{t('أو استخدم زر المسح أعلاه لقراءة QR', 'Or use scan button above to read a QR')}</p>
                </div>
              ) : (
                <>
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0 transition-colors">
                     <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-4">
                       <div className="flex-1">
                         <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-md flex items-center gap-1">{getIcon(selectedMapLoc.type, "w-3 h-3")} {selectedMapLoc.type}</span>
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md">ID: {selectedMapLoc.id}</span>
                         </div>
                         <h2 className="text-2xl font-black text-slate-800 dark:text-white mt-2">{selectedMapLoc.name}</h2>
                         <p className="text-xs font-bold text-blue-500 dark:text-blue-400 mt-1">{getFullLocationPath(selectedMapLoc.id)}</p>
                         <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">{selectedMapLoc.description}</p>
                         {/* ✅ مؤشر الامتلاء */}
                         {['Box','Bin','Drawer','Shelf','Cabinet','Rack'].includes(selectedMapLoc.type) && (() => {
                           const stats = getLocationStats(selectedMapLoc.id);
                           const pct = Math.min(Math.round((stats.totalQty / (selectedMapLoc.max_capacity || 100)) * 100), 100);
                           const color = pct > 90 ? '#ef4444' : pct > 60 ? '#f97316' : '#22c55e';
                           return (
                             <div className="flex items-center gap-3 mt-3">
                               <div className="relative w-14 h-14 flex-shrink-0">
                                 <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                                   <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" className="dark:stroke-slate-700"/>
                                   <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round"/>
                                 </svg>
                                 <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-slate-700 dark:text-slate-200">{pct}%</span>
                               </div>
                               <div>
                                 <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('نسبة الامتلاء', 'Fill Rate')}</p>
                                 <p className="text-sm font-black text-slate-700 dark:text-slate-200">{stats.totalQty} / {selectedMapLoc.max_capacity} {t('قطعة', 'items')}</p>
                               </div>
                             </div>
                           );
                         })()}
                       </div>

                       {isSuperAdmin && (
                         <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                           <Button onClick={() => openLocEdit(selectedMapLoc)} variant="outline" className="font-bold text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"><Pencil className="w-4 h-4 mr-1"/> {t('تعديل', 'Edit')}</Button>
                           <Button onClick={() => printBarcodeLabel(selectedMapLoc)} variant="outline" className="font-bold text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Printer className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-1"/> {t('طباعة', 'Print')}</Button>
                           <Button onClick={() => handleDeleteLocation(selectedMapLoc.id)} variant="outline" className="text-red-500 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 transition-colors"><Trash2 className="w-4 h-4"/></Button>
                         </div>
                       )}
                     </div>
                  </div>

                  <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-slate-900/30 space-y-6">
                     {selectedMapChildren.length > 0 && (
                         <div>
                             <h3 className="font-black text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2 text-sm"><Layers className="w-4 h-4 text-orange-500 dark:text-orange-400"/> {t('الأماكن المتفرعة:', 'Sub-locations:')}</h3>
                             <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                 {selectedMapChildren.map(child => (
                                     <div key={child.id} onClick={() => handleSelectLocation(child)} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all flex items-center gap-3">
                                         <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">{getIcon(child.type, "w-5 h-5")}</div>
                                         <div className="min-w-0 flex-1">
                                             <p className="font-bold text-sm truncate text-slate-800 dark:text-slate-200">{child.name}</p>
                                             <p className="text-[10px] text-slate-400 dark:text-slate-500">{child.type}</p>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     )}

                     <div>
                        <div className="flex justify-between items-center mb-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <h3 className="font-black text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><Package className="w-4 h-4 text-blue-500 dark:text-blue-400"/> {t('القطع الموجودة هنا:', 'Items here:')}</h3>
                        </div>
                        {viewMode === 'grid' ? renderDeviceCards(locItems) : renderDeviceTable(locItems)}
                     </div>
                  </div>
                </>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reverse-search" className="space-y-0">
          {(() => {
            const [itemQ, setItemQ] = [locationSearch, setLocationSearch];
            const [locQ, setLocQ] = [treeSearch, setTreeSearch];
            const itemResults = reverseByItem(itemQ);
            const locResults = reverseByLocation(locQ);
            const hasItemQ = itemQ.trim() !== '';
            const hasLocQ = locQ.trim() !== '';

            return (
              <div className="flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md"><Search className="w-5 h-5"/></div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">{t('البحث العكسي', 'Reverse Search')}</h2>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold">{t('ابحث باسم القطعة أو المكان الكامل', 'Search by item name or full location path')}</p>
                  </div>
                </div>

                {/* خانتا البحث */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* ===== بحث بالقطعة ===== */}
                  <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-l from-blue-50 to-white dark:from-blue-900/10 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><Package className="w-4 h-4 text-white"/></div>
                        <div>
                          <p className="font-black text-sm text-slate-800 dark:text-white">{t('ابحث بالقطعة', 'Search by Item')}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{t('اعرف أين تجدها في المعمل', 'Find where it is in the lab')}</p>
                        </div>
                      </div>
                      <div className="relative">
                        <Search className={`absolute ${lang==='ar'?'right-3':'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`}/>
                        <Input value={itemQ} onChange={e => setItemQ(e.target.value)}
                          placeholder={t('اسم القطعة أو التصنيف...', 'Item name or category...')}
                          className={`h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-white font-medium ${lang==='ar'?'pr-9':'pl-9'}`}/>
                        {hasItemQ && <button onClick={() => setItemQ('')} className={`absolute ${lang==='ar'?'left-3':'right-3'} top-1/2 -translate-y-1/2`}><X className="w-4 h-4 text-slate-400 hover:text-slate-600"/></button>}
                      </div>
                    </div>

                    {/* Results */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar" style={{maxHeight: '380px'}}>
                      {!hasItemQ ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-700">
                          <Package className="w-12 h-12 mb-3"/>
                          <p className="text-xs font-bold text-slate-400">{t('اكتب اسم القطعة', 'Type item name')}</p>
                        </div>
                      ) : itemResults.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <Search className="w-10 h-10 text-slate-200 dark:text-slate-700 mb-2"/>
                          <p className="text-sm font-bold text-slate-400">{t('لا توجد نتائج', 'No results')}</p>
                        </div>
                      ) : itemResults.map((c, i) => (
                        <div key={i} onClick={() => openEdit(c)} className="flex items-start gap-3 p-4 border-b border-slate-50 dark:border-slate-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer group">
                          <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-1.5 flex-shrink-0">
                            <img src={c.imageUrl||'https://cdn-icons-png.flaticon.com/512/679/679821.png'} className="w-full h-full object-contain"/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-black text-sm text-slate-800 dark:text-slate-200 truncate">{displayCompName(c)}</p>
                              <span className={`text-xs font-black flex-shrink-0 px-1.5 py-0.5 rounded-md ${c.quantity===0?'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400':c.quantity<5?'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400':'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>{c.quantity}</span>
                            </div>
                            {/* المسار الكامل */}
                            {c.location_ids && c.location_ids.length > 0 ? (
                              <div className="space-y-1">
                                {c.location_ids.map(id => (
                                  <div key={id} className="flex items-center gap-1 text-[10px] font-bold text-teal-600 dark:text-teal-400">
                                    <MapPin className="w-3 h-3 flex-shrink-0"/>
                                    <span className="truncate">{getFullLocationPath(id)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3"/>{t('موقع غير محدد', 'No location set')}</p>
                            )}
                          </div>
                          {isSuperAdmin && <Pencil className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-1"/>}
                        </div>
                      ))}
                    </div>
                    {hasItemQ && itemResults.length > 0 && (
                      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-400">{itemResults.length} {t('نتيجة', 'results')}</p>
                      </div>
                    )}
                  </div>

                  {/* ===== بحث بالمكان ===== */}
                  <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-l from-purple-50 to-white dark:from-purple-900/10 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center"><MapPin className="w-4 h-4 text-white"/></div>
                        <div>
                          <p className="font-black text-sm text-slate-800 dark:text-white">{t('ابحث بالمكان', 'Search by Location')}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{t('اعرف وش فيه — يبحث في المسار الكامل', 'Find what is inside — searches full path')}</p>
                        </div>
                      </div>
                      <div className="relative">
                        <Search className={`absolute ${lang==='ar'?'right-3':'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`}/>
                        <Input value={locQ} onChange={e => setLocQ(e.target.value)}
                          placeholder={t('مثال: المعمل ← خزانة A ← رف 2', 'e.g. Lab → Cabinet A → Shelf 2')}
                          className={`h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-white font-medium ${lang==='ar'?'pr-9':'pl-9'}`}/>
                        {hasLocQ && <button onClick={() => setLocQ('')} className={`absolute ${lang==='ar'?'left-3':'right-3'} top-1/2 -translate-y-1/2`}><X className="w-4 h-4 text-slate-400 hover:text-slate-600"/></button>}
                      </div>
                      {/* مقترحات أماكن */}
                      {hasLocQ && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {flatLocations.filter(l => normalize(getFullLocationPath(l.id)).includes(normalize(locQ))).slice(0,4).map(l => (
                            <button key={l.id} onClick={() => setLocQ(getFullLocationPath(l.id))}
                              className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${normalize(getFullLocationPath(l.id)) === normalize(locQ) ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-purple-300'}`}>
                              {getIcon(l.type, "w-3 h-3")} {getFullLocationPath(l.id)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Results */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar" style={{maxHeight: '380px'}}>
                      {!hasLocQ ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-700">
                          <MapPin className="w-12 h-12 mb-3"/>
                          <p className="text-xs font-bold text-slate-400">{t('اكتب اسم المكان', 'Type location name')}</p>
                        </div>
                      ) : locResults.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <Search className="w-10 h-10 text-slate-200 dark:text-slate-700 mb-2"/>
                          <p className="text-sm font-bold text-slate-400">{t('لا توجد قطع في هذا المكان', 'No items in this location')}</p>
                        </div>
                      ) : locResults.map((c, i) => (
                        <div key={i} onClick={() => openEdit(c)} className="flex items-start gap-3 p-4 border-b border-slate-50 dark:border-slate-800 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors cursor-pointer group">
                          <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-1.5 flex-shrink-0">
                            <img src={c.imageUrl||'https://cdn-icons-png.flaticon.com/512/679/679821.png'} className="w-full h-full object-contain" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }}/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-black text-sm text-slate-800 dark:text-slate-200 truncate">{displayCompName(c)}</p>
                              <span className={`text-xs font-black flex-shrink-0 px-1.5 py-0.5 rounded-md ${c.quantity===0?'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400':c.quantity<5?'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400':'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>{c.quantity}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">{lang==='ar'?getCatAr(c):getCatEn(c)}</p>
                            {c.location_ids && c.location_ids.length > 0 && (
                              <div className="space-y-0.5 mt-1">
                                {c.location_ids.map(id => (
                                  <p key={id} className="text-[10px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 truncate">
                                    <MapPin className="w-3 h-3 flex-shrink-0"/>{getFullLocationPath(id)}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          {isSuperAdmin && <Pencil className="w-4 h-4 text-slate-300 group-hover:text-purple-500 transition-colors flex-shrink-0 mt-1"/>}
                        </div>
                      ))}
                    </div>
                    {hasLocQ && locResults.length > 0 && (
                      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-slate-400">{locResults.length} {t('قطعة', 'items')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </TabsContent>

                <TabsContent value="maintenance" className="space-y-4">
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl border border-orange-200 dark:border-orange-800/50 flex items-center gap-3 transition-colors">
            <Wrench className="w-8 h-8 text-orange-600 dark:text-orange-400 shrink-0"/>
            <div>
              <h3 className="font-black text-orange-800 dark:text-orange-400 text-lg">{t('إدارة صيانة القطع', 'Maintenance Management')}</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 mt-6">
            {maintenanceItems.length === 0 ? (
               <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 transition-colors"><CheckCircle2 className="w-16 h-16 text-emerald-300 dark:text-emerald-700/50 mx-auto mb-4" /><p className="font-bold text-slate-600 dark:text-slate-400">{t('لا توجد قطع تحت الصيانة', 'No items in maintenance')}</p></div>
            ) : (
              maintenanceItems.map((item) => {
                const stockItem = components.find(i => getNameAr(i) === item.item_name);
                const imgUrl = stockItem?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png';
                return (
                  <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-6 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1.5 rounded-xl"><img src={imgUrl} className="max-w-full max-h-full object-contain grayscale" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }} /></div>
                      <div>
                        <h4 className="font-bold text-lg mb-1 dark:text-slate-200">{item.item_name} <span className="text-xs text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-md">x{item.quantity}</span></h4>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('بواسطة:', 'By:')} {item.student_name}</p>
                      </div>
                    </div>
                    {isSuperAdmin && (
                        <div className="flex gap-3">
                          <Button onClick={() => handleResolveMaintenance(item.id, 'repaired', item.item_name, item.quantity)} className="bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle2 className="w-4 h-4 mr-1"/> {t('إصلاح', 'Repair')}</Button>
                          <Button onClick={() => handleResolveMaintenance(item.id, 'scrapped', item.item_name, item.quantity)} variant="outline" className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border-red-200 dark:border-red-900/50"><Trash2 className="w-4 h-4 mr-1"/> {t('إتلاف', 'Scrap')}</Button>
                        </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ✅ مودال تأكيد الحذف */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteConfirmOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 dark:text-white">{t('تأكيد الحذف', 'Confirm Delete')}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t('لا يمكن التراجع عن هذه العملية', 'This action cannot be undone')}</p>
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-5">
              <p className="text-sm font-bold text-red-700 dark:text-red-400 text-center">{itemToDelete}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmOpen(false)} className="flex-1 h-11 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">
                {t('إلغاء', 'Cancel')}
              </button>
              <Button onClick={confirmDelete} className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-bold gap-2">
                <Trash2 className="w-4 h-4" /> {t('حذف نهائي', 'Delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 نافذة الكاميرا الخاصة بالمكتبة الجديدة */}
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-black border-none" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader className="p-4 bg-slate-900 border-b border-slate-800">
            <DialogTitle className="text-xl font-black flex items-center gap-2 text-white">
              <ScanLine className="w-6 h-6 text-purple-400" /> {t('مسح كود الصندوق', 'Scan QR Code')}
            </DialogTitle>
          </DialogHeader>

          <div className="relative w-full aspect-square bg-black">
            {isScannerOpen && (
              <Scanner
                  onScan={(detectedCodes) => {
                     if (detectedCodes && detectedCodes.length > 0) {
                        const code = detectedCodes[0].rawValue;
                        setIsScannerOpen(false);
                        processBarcodeText(code);
                     }
                  }}
                  onError={(error) => { /* يتم تجاهل الأخطاء المستمرة للكاميرا */ }}
                  constraints={{ facingMode: 'environment' }}
                  components={{
                    onOff: true,
                    torch: true,
                    zoom: true,
                    finder: false
                  }}
              />
            )}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
               <div className="w-64 h-64 border-4 border-purple-500 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-center">
             <p className="text-xs font-bold text-slate-400 mb-4">{t('وجه الكاميرا نحو المربع المطبوع', 'Point camera at the QR Code')}</p>
             <Button variant="outline" onClick={() => setIsScannerOpen(false)} className="w-full font-bold bg-white dark:bg-slate-700 text-black dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 border-none">{t('إغلاق', 'Close')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 📦 بوب-أب نتيجة مسح الباركود */}
      {/* ========================================================================= */}
      <Dialog open={isScanResultOpen} onOpenChange={setIsScanResultOpen}>
        <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-xl font-black flex items-center gap-2 text-slate-800 dark:text-white">
              <ScanLine className="w-6 h-6 text-emerald-500" />
              {t('محتويات الموقع', 'Location Contents')}
            </DialogTitle>
          </DialogHeader>

          {scanResultLoc && (() => {
            const stats = getLocationStats(scanResultLoc.id);
            const pct = Math.min(Math.round((stats.totalQty / (scanResultLoc.max_capacity || 100)) * 100), 100);
            const isEmpty = stats.totalQty === 0;
            const color = isEmpty ? '#ef4444' : pct > 90 ? '#f97316' : '#22c55e';

            return (
              <div className="space-y-4 pt-2">
                {/* رأس الموقع */}
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl flex-shrink-0 ${isEmpty ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                    {getIcon(scanResultLoc.type, "w-8 h-8")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-black uppercase bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-md">{scanResultLoc.type}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${isEmpty ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
                        {isEmpty ? t('فاضي', 'Empty') : t('فيه قطع', 'Has Items')}
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">{scanResultLoc.name}</h2>
                    <p className="text-xs font-bold text-blue-500 dark:text-blue-400 mt-0.5">{getFullLocationPath(scanResultLoc.id)}</p>
                  </div>
                  {/* دائرة نسبة الامتلاء */}
                  <div className="relative w-14 h-14 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" className="dark:stroke-slate-700"/>
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round"/>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-700 dark:text-slate-200">{pct}%</span>
                  </div>
                </div>

                {/* إحصائيات سريعة */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{scanResultItems.length}</p>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{t('نوع قطعة', 'Item Types')}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalQty}</p>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{t('إجمالي الكميات', 'Total Qty')}</p>
                  </div>
                </div>

                {/* قائمة القطع */}
                {scanResultItems.length > 0 ? (
                  <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-1.5 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                    {scanResultItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 min-w-0">
                          <Package className="w-4 h-4 text-blue-400 flex-shrink-0"/>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{displayCompName(item)}</p>
                        </div>
                        <span className={`text-sm font-black px-2.5 py-0.5 rounded-lg flex-shrink-0 ${item.quantity === 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : item.quantity < 5 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
                          {item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                    <Package className="w-10 h-10 text-red-300 dark:text-red-700 mx-auto mb-2"/>
                    <p className="font-black text-red-500 dark:text-red-400">{t('البوكس فاضي', 'Box is Empty')}</p>
                    <p className="text-xs text-red-400 dark:text-red-500 mt-1">{t('لا يوجد قطع مسجلة في هذا الموقع', 'No items registered here')}</p>
                  </div>
                )}

                {/* أزرار الإجراءات */}
                <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {isSuperAdmin && (
                    <Button
                      onClick={() => {
                        setIsScanResultOpen(false);
                        setFormData({ name_ar: '', name_en: '', quantity: 0, category_ar: 'عام', category_en: 'General', location_ids: [scanResultLoc.id], imageUrl: '', original_name_ar: '' });
                        setIsNewCategory(false);
                        setIsAddOpen(true);
                        setFormStep(1);
                        setLocSearch('');
                      }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
                    >
                      <Plus className="w-4 h-4"/> {t('إضافة قطعة هنا', 'Add Item Here')}
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      setIsScanResultOpen(false);
                      setActiveTab('locations-map');
                      handleSelectLocation(scanResultLoc, flatLocations, components);
                    }}
                    variant="outline"
                    className="flex-1 font-bold gap-2"
                  >
                    <Map className="w-4 h-4"/> {t('عرض في الخريطة', 'View on Map')}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* نوافذ إضافة/تعديل القطع والمواقع (بكامل تصميمها الأصلي) */}
      {/* ========================================================================= */}
      <Dialog open={isAddOpen || isEditOpen} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); setIsEditOpen(false); setFormStep(1); } }}>
        <DialogContent className="max-w-2xl font-sans p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-colors" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

          {/* ===== Header ===== */}
          <DialogHeader className="bg-slate-50 dark:bg-slate-950 p-5 border-b border-slate-100 dark:border-slate-800 transition-colors">
            <DialogTitle className="text-xl font-black flex items-center gap-2 text-slate-800 dark:text-white mb-3">
              {isEditOpen ? <Pencil className="w-5 h-5 text-blue-600 dark:text-blue-400" /> : <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              {isEditOpen ? t('تعديل القطعة', 'Edit Item') : t('إضافة قطعة جديدة', 'Add New Item')}
            </DialogTitle>
            {/* ✅ Progress Steps */}
            <div className="flex items-center gap-0">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-r-full rounded-l-none transition-all ${formStep === 1 ? 'bg-blue-600 text-white' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${formStep === 1 ? 'bg-white text-blue-600' : 'bg-emerald-500 text-white'}`}>
                  {formStep === 1 ? '1' : '✓'}
                </span>
                <span className="text-sm font-bold">{t('المعلومات', 'Info')}</span>
              </div>
              <div className={`h-0.5 w-8 ${formStep === 2 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
              <div className={`flex items-center gap-2 px-4 py-2 rounded-l-full rounded-r-none transition-all ${formStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${formStep === 2 ? 'bg-white text-blue-600' : 'bg-slate-300 dark:bg-slate-600 text-slate-500'}`}>2</span>
                <span className="text-sm font-bold">{t('الموقع', 'Location')}</span>
              </div>
            </div>
          </DialogHeader>

          {/* ===== Step 1: معلومات القطعة ===== */}
          {formStep === 1 && (
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">

              {/* Preview + Image */}
              <div className="flex gap-4 items-start">
                <div className="w-20 h-20 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {formData.imageUrl
                    ? <img src={formData.imageUrl} className="w-full h-full object-contain p-1" onError={e => (e.currentTarget.style.display = 'none')} />
                    : <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />}
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">{t('رابط الصورة', 'Image URL')}</Label>
                  <div className="relative">
                    <Globe className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                    <Input className={`h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm dark:text-white ${lang === 'ar' ? 'pr-10' : 'pl-10'} text-left`} placeholder="https://..." value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} dir="ltr" />
                  </div>
                </div>
              </div>

              {/* الأسماء */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">{t('الاسم (عربي)', 'Name (AR)')} <span className="text-red-500">*</span></Label>
                  <Input value={formData.name_ar} onChange={e => setFormData({...formData, name_ar: e.target.value})} dir="rtl" className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white" placeholder={t('مثال: أردوينو أونو', 'e.g. Arduino Uno')} />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">{t('الاسم (إنجليزي)', 'Name (EN)')}</Label>
                  <Input value={formData.name_en} onChange={e => setFormData({...formData, name_en: e.target.value})} dir="ltr" className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white text-left" placeholder="e.g. Arduino Uno" />
                </div>
              </div>

              {/* الكمية والتصنيف */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">{t('الكمية', 'Quantity')}</Label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setFormData({...formData, quantity: Math.max(0, formData.quantity - 1)})} className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex-shrink-0">−</button>
                    <Input type="number" min="0" className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-black text-xl dark:text-white text-center" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} />
                    <button onClick={() => setFormData({...formData, quantity: formData.quantity + 1})} className="w-11 h-11 rounded-xl bg-blue-600 text-white font-black text-xl hover:bg-blue-700 transition-colors flex-shrink-0">+</button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">{t('التصنيف', 'Category')}</Label>
                  {!isNewCategory ? (
                    <Select value={lang === 'ar' ? formData.category_ar : formData.category_en} onValueChange={val => {
                      if(val === 'new') setIsNewCategory(true);
                      else { const matched = components.find(c => getCatAr(c) === val || getCatEn(c) === val); setFormData({...formData, category_ar: matched ? getCatAr(matched) : val, category_en: matched ? getCatEn(matched) : val}); }
                    }}>
                      <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold dark:text-white" dir={lang === 'ar' ? 'rtl' : 'ltr'}><SelectValue /></SelectTrigger>
                      <SelectContent dir={lang === 'ar' ? 'rtl' : 'ltr'} className="dark:bg-slate-900 dark:border-slate-800">
                        {(lang === 'ar' ? allCategoriesAr : allCategoriesEn).filter(c => c !== 'All').map(cat => <SelectItem key={cat} value={cat} className="dark:text-white">{cat}</SelectItem>)}
                        <SelectItem value="new" className="text-blue-600 dark:text-blue-400 font-black">{t('+ قسم جديد', '+ New Category')}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="grid grid-cols-5 gap-2 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50">
                      <Input className="col-span-2 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-10 text-sm dark:text-white" placeholder="AR" value={newCatAr} onChange={e => setNewCatAr(e.target.value)} dir="rtl" />
                      <Input className="col-span-2 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-10 text-sm dark:text-white" placeholder="EN" value={newCatEn} onChange={e => setNewCatEn(e.target.value)} dir="ltr" />
                      <Button variant="ghost" className="col-span-1 text-red-600 dark:text-red-400 h-10 px-0 font-bold" onClick={() => setIsNewCategory(false)}><X className="w-4 h-4"/></Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== Step 2: اختيار الموقع ===== */}
          {formStep === 2 && (
            <div className="flex flex-col max-h-[60vh]">

              {/* المواقع المحددة */}
              {(formData.location_ids?.length ?? 0) > 0 && (
                <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 bg-blue-50 dark:bg-blue-900/10">
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2">{t('المواقع المحددة:', 'Selected Locations:')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {formData.location_ids?.map(id => (
                      <span key={id} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm">
                        <MapPin className="w-3 h-3" /> {getFullLocationPath(id)}
                        <button onClick={() => setFormData({...formData, location_ids: formData.location_ids?.filter(x => x !== id)})} className="text-slate-400 hover:text-red-500 transition-colors"><X className="w-3 h-3"/></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* بحث في المواقع */}
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                  <Input value={locSearch} onChange={e => setLocSearch(e.target.value)} placeholder={t('ابحث في المواقع...', 'Search locations...')}
                    className={`h-10 text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white ${lang === 'ar' ? 'pr-9' : 'pl-9'}`} />
                  {locSearch && <button onClick={() => setLocSearch('')} className={`absolute ${lang === 'ar' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2`}><X className="w-3.5 h-3.5 text-slate-400"/></button>}
                </div>
              </div>

              {/* شجرة المواقع أو نتائج البحث */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                {locSearch ? (
                  // نتائج بحث مسطحة
                  <div className="space-y-1">
                    {flatLocations
                      .filter(l => l.name.toLowerCase().includes(locSearch.toLowerCase()) || l.barcode?.toLowerCase().includes(locSearch.toLowerCase()) || getFullLocationPath(l.id).toLowerCase().includes(locSearch.toLowerCase()))
                      .map(loc => {
                        const isSelected = formData.location_ids?.includes(loc.id);
                        return (
                          <button key={loc.id} onClick={() => {
                            if (isSelected) setFormData({...formData, location_ids: formData.location_ids?.filter(x => x !== loc.id)});
                            else setFormData({...formData, location_ids: [...(formData.location_ids || []), loc.id]});
                          }} className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-600' : 'bg-slate-100 dark:bg-slate-800'}`}>
                              {isSelected ? <CheckCircle2 className="w-4 h-4 text-white" /> : getIcon(loc.type, "w-4 h-4")}
                            </div>
                            <div className="flex-1 min-w-0 text-start">
                              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{loc.name} <span className="text-[10px] text-slate-400">({loc.type})</span></p>
                              <p className="text-[11px] text-blue-500 dark:text-blue-400 truncate">{getFullLocationPath(loc.id)}</p>
                            </div>
                          </button>
                        );
                      })}
                    {flatLocations.filter(l => l.name.toLowerCase().includes(locSearch.toLowerCase())).length === 0 && (
                      <p className="text-center text-slate-400 font-bold py-8">{t('لا نتائج', 'No results')}</p>
                    )}
                  </div>
                ) : (
                  // شجرة تفاعلية
                  <LocationPickerTree
                    nodes={locationTree}
                    selectedIds={formData.location_ids || []}
                    onToggle={(id) => {
                      const cur = formData.location_ids || [];
                      if (cur.includes(id)) setFormData({...formData, location_ids: cur.filter(x => x !== id)});
                      else setFormData({...formData, location_ids: [...cur, id]});
                    }}
                    getIcon={getIcon}
                    getFullPath={getFullLocationPath}
                  />
                )}
              </div>
            </div>
          )}

          {/* ===== Footer ===== */}
          <div className="p-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => { if (formStep === 2) setFormStep(1); else { setIsAddOpen(false); setIsEditOpen(false); } }}
              className="font-bold h-11 dark:text-white border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 gap-2">
              {formStep === 2 ? (lang === 'ar' ? <ChevronRight className="w-4 h-4"/> : <ChevronRight className="w-4 h-4 rotate-180"/>) : null}
              {formStep === 2 ? t('رجوع', 'Back') : t('إلغاء', 'Cancel')}
            </Button>
            <div className="flex items-center gap-2">
              {formStep === 1 && (
                <Button onClick={() => handleSaveItem(isEditOpen)} variant="outline" className="font-bold h-11 border-slate-300 dark:border-slate-700 dark:text-white gap-2">
                  {t('حفظ بدون موقع', 'Save Without Location')}
                </Button>
              )}
              {formStep === 1 ? (
                <Button onClick={() => { if (!formData.name_ar?.trim()) { toast({ title: t('تنبيه', 'Warning'), description: t('أدخل اسم القطعة أولاً', 'Enter item name first'), variant: 'destructive' }); return; } setFormStep(2); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-6 gap-2">
                  {t('التالي: الموقع', 'Next: Location')}
                  {lang === 'ar' ? <ChevronLeft className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                </Button>
              ) : (
                <Button onClick={() => handleSaveItem(isEditOpen)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-8 gap-2 shadow-md">
                  <CheckCircle2 className="w-4 h-4" /> {t('حفظ القطعة', 'Save Item')}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLocModalOpen} onOpenChange={setIsLocModalOpen}>
        <DialogContent className="max-w-lg font-sans p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <DialogTitle className="text-xl font-black flex items-center gap-2 text-slate-800 dark:text-white">
              {isLocEditMode ? <Pencil className="w-5 h-5 text-blue-600"/> : <Plus className="w-5 h-5 text-blue-600"/>}
              {isLocEditMode ? t('تعديل الموقع', 'Edit Location') : t('إضافة موقع جديد', 'Add Location')}
            </DialogTitle>
          </DialogHeader>

          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">

            {/* ✅ اختيار النوع بصور */}
            <div className="space-y-2">
              <Label className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">{t('نوع الموقع', 'Location Type')}</Label>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { type: 'Room',    Icon: Home,          label: t('غرفة','Room'),    active: 'bg-indigo-600 text-white border-indigo-600', inactive: 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-slate-300 dark:border-slate-700 hover:border-indigo-500' },
                  { type: 'Zone',    Icon: Map,           label: t('منطقة','Zone'),   active: 'bg-purple-600 text-white border-purple-600', inactive: 'bg-slate-100 dark:bg-slate-800 text-purple-600 dark:text-purple-400 border-slate-300 dark:border-slate-700 hover:border-purple-500' },
                  { type: 'Cabinet', Icon: Server,         label: t('دولاب','Cabinet'),active: 'bg-blue-600 text-white border-blue-600',    inactive: 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-slate-300 dark:border-slate-700 hover:border-blue-500' },
                  { type: 'Rack',    Icon: AlignJustify,  label: t('حامل','Rack'),    active: 'bg-cyan-600 text-white border-cyan-600',    inactive: 'bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border-slate-300 dark:border-slate-700 hover:border-cyan-500' },
                  { type: 'Shelf',   Icon: Layers,         label: t('رف','Shelf'),     active: 'bg-orange-600 text-white border-orange-600',inactive: 'bg-slate-100 dark:bg-slate-800 text-orange-600 dark:text-orange-400 border-slate-300 dark:border-slate-700 hover:border-orange-500' },
                  { type: 'Drawer',  Icon: Archive,        label: t('درج','Drawer'),   active: 'bg-amber-600 text-white border-amber-600',  inactive: 'bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 border-slate-300 dark:border-slate-700 hover:border-amber-500' },
                  { type: 'Box',     Icon: Package,        label: t('صندوق','Box'),    active: 'bg-emerald-600 text-white border-emerald-600',inactive: 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-slate-300 dark:border-slate-700 hover:border-emerald-500' },
                  { type: 'Bin',     Icon: ShoppingBasket, label: t('حاوية','Bin'),    active: 'bg-teal-600 text-white border-teal-600',    inactive: 'bg-slate-100 dark:bg-slate-800 text-teal-600 dark:text-teal-400 border-slate-300 dark:border-slate-700 hover:border-teal-500' },
                ] as const).map(({ type, Icon, label, active, inactive }) => (
                  <button key={type} onClick={() => setLocForm({...locForm, type: type as LocType})}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      locForm.type === type
                        ? active + ' shadow-lg scale-105'
                        : inactive + ' opacity-70 hover:opacity-100'
                    }`}>
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-black leading-none">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* اسم الموقع */}
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">{t('اسم الموقع', 'Location Name')} <span className="text-red-500">*</span></Label>
              <Input value={locForm.name} onChange={e => setLocForm({...locForm, name: e.target.value})}
                placeholder={t('مثال: خزانة A، رف 1', 'e.g. Cabinet A, Shelf 1')}
                className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white" />
            </div>

            {/* ✅ اختيار الأب — شجرة تفاعلية صغيرة */}
            <div className="space-y-2">
              <Label className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                {t('الموقع الأب', 'Parent Location')}
                <span className="text-slate-400 font-normal mr-1 ml-1">({t('اختياري', 'optional')})</span>
              </Label>

              {/* العرض الحالي */}
              <div className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all ${locForm.parent_id === 'none' ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950' : 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'}`}>
                {locForm.parent_id === 'none' ? (
                  <span className="text-sm font-bold text-slate-400 dark:text-slate-500 flex-1">{t('— مستقل (جذر) —', '— Root (No Parent) —')}</span>
                ) : (
                  <>
                    {getIcon(flatLocations.find(l => l.id === parseInt(locForm.parent_id))?.type || 'Room', "w-4 h-4")}
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300 flex-1 truncate">{getFullLocationPath(parseInt(locForm.parent_id))}</span>
                    <button onClick={() => setLocForm({...locForm, parent_id: 'none'})} className="text-slate-400 hover:text-red-500 transition-colors"><X className="w-4 h-4"/></button>
                  </>
                )}
              </div>

              {/* شجرة مصغرة للاختيار */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950">
                <div className="p-1.5 space-y-0.5">
                  <button onClick={() => setLocForm({...locForm, parent_id: 'none'})}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-sm font-bold transition-colors text-start ${locForm.parent_id === 'none' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <span className="w-4 h-4 flex items-center justify-center text-slate-400">—</span>
                    {t('مستقل (جذر)', 'Root (No Parent)')}
                  </button>
                  {flatLocations.filter(l => l.id !== editingLocId).map(loc => (
                    <button key={loc.id} onClick={() => setLocForm({...locForm, parent_id: loc.id.toString()})}
                      style={{ paddingRight: lang === 'ar' ? `${(flatLocations.filter(p => p.id === loc.parent_id).length > 0 ? 1 : 0) * 12 + 8}px` : '8px', paddingLeft: lang === 'ar' ? '8px' : `${(flatLocations.filter(p => p.id === loc.parent_id).length > 0 ? 1 : 0) * 12 + 8}px` }}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg text-sm transition-colors text-start ${locForm.parent_id === loc.id.toString() ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'}`}>
                      <span className="flex-shrink-0">{getIcon(loc.type, "w-3.5 h-3.5")}</span>
                      <span className="truncate text-xs">{getFullLocationPath(loc.id)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* باركود + سعة */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">{t('السعة القصوى', 'Max Capacity')}</Label>
                <Input type="number" min="1" value={locForm.max_capacity}
                  onChange={e => setLocForm({...locForm, max_capacity: parseInt(e.target.value) || 100})}
                  className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">{t('باركود', 'Barcode')}</Label>
                <Input value={locForm.barcode} onChange={e => setLocForm({...locForm, barcode: e.target.value})}
                  placeholder={t('تلقائي', 'Auto')}
                  className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white font-mono" dir="ltr" />
              </div>
            </div>

            {/* وصف اختياري */}
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                {t('وصف', 'Description')} <span className="text-slate-400 font-normal">({t('اختياري', 'optional')})</span>
              </Label>
              <Input value={locForm.description} onChange={e => setLocForm({...locForm, description: e.target.value})}
                placeholder={t('وصف قصير للموقع', 'Short description')}
                className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white" />
            </div>
          </div>

          <div className="p-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setIsLocModalOpen(false)} className="font-bold h-11 dark:text-white border-slate-300 dark:border-slate-700">{t('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleSaveLocation} disabled={!locForm.name} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 h-11 shadow-md gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {isLocEditMode ? t('حفظ التعديلات', 'Save Changes') : t('إضافة الموقع', 'Add Location')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInventory;