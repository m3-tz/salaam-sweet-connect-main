import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';import { Plus, Trash2, Map, Server, Layers, Package, MapPin, Printer, ChevronDown, ChevronRight, Inbox, Pencil, GripVertical, AlertTriangle, ClipboardCheck, CheckCircle2, Home, AlignJustify, Archive, ShoppingBasket } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '../../LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiUrl } from '@/lib/api';

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
  name_ar?: string;
  name_en?: string;
  quantity: number;
  imageUrl: string;
  location_ids?: number[];
  name?: string;
}

const AdminLocations = () => {
  const { lang, t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();

  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [flatLocations, setFlatLocations] = useState<StorageLocation[]>([]);
  const [allItems, setAllItems] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedLoc, setSelectedLoc] = useState<StorageLocation | null>(null);
  const [locItems, setLocItems] = useState<Device[]>([]);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', type: 'Box' as LocType, parent_id: 'none', barcode: '', description: '', max_capacity: 100 });

  const [isParentPickerOpen, setIsParentPickerOpen] = useState(false); // 🌟 نافذة اختيار الأب من الشجرة

  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [auditItems, setAuditItems] = useState<{name: string, original: number, current: number}[]>([]);

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

  const fetchLocationsAndItems = async () => {
    setLoading(true);
    try {
      const [locRes, itemRes] = await Promise.all([
        fetch(apiUrl('/api/admin/locations')),
        fetch(apiUrl('/api/items'))
      ]);
      const locData = await locRes.json();
      const itemData = await itemRes.json();

      if (locRes.ok) {
        setFlatLocations(locData.data);
        setLocations(buildTree(locData.data));
        if (selectedLoc) {
            const updatedLoc = locData.data.find((l: StorageLocation) => l.id === selectedLoc.id);
            if(updatedLoc) handleSelectLocation(updatedLoc, locData.data, itemData.data);
            else setSelectedLoc(null);
        }
      }
      if (itemRes.ok) setAllItems(itemData.data);

    } catch (error) { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLocationsAndItems(); }, []);

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
const map = new globalThis.Map<number, string>();    flatLocations.forEach(loc => {
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

  const getChildIds = (id: number, allLocs: StorageLocation[] = flatLocations): number[] => {
      const children = allLocs.filter(l => l.parent_id === id).map(l => l.id);
      let all = [id, ...children];
      children.forEach(c => { all = [...all, ...getChildIds(c, allLocs)] });
      return all;
  };

  const handleSelectLocation = (loc: StorageLocation, overrideLocs = flatLocations, overrideItems = allItems) => {
    setSelectedLoc(loc);
    const relevantIds = getChildIds(loc.id, overrideLocs);
    const itemsInThisTree = overrideItems.filter(item => item.location_ids?.some(id => relevantIds.includes(id)));
    setLocItems(itemsInThisTree);
  };

  const handleDrop = async (e: React.DragEvent, targetId: number | null) => {
      e.preventDefault(); setDragOverId(null);
      const draggedId = parseInt(e.dataTransfer.getData('loc_id'));

      const isDescendant = (dragId: number, tgtId: number) => {
        let current = flatLocations.find(l => l.id === tgtId);
        while (current) {
            if (current.parent_id === dragId) return true;
            current = flatLocations.find(l => l.id === current?.parent_id);
        }
        return false;
      };

      if (!draggedId || draggedId === targetId || (targetId && isDescendant(draggedId, targetId))) {
          toast({ title: t('حركة غير صالحة', 'Invalid move'), variant: 'destructive' });
          return;
      }
      const draggedLoc = flatLocations.find(l => l.id === draggedId);
      if (!draggedLoc) return;

      try {
        const res = await fetch(apiUrl(`/api/admin/locations/${draggedId}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
          body: JSON.stringify({ ...draggedLoc, parent_id: targetId === null ? 'none' : targetId })
        });
        if (res.ok) { toast({ title: t('تم النقل بنجاح 🚚', 'Moved successfully 🚚') }); fetchLocationsAndItems(); }
      } catch (error) { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const locationStatsMap = useMemo(() => {
    const stats = new globalThis.Map<number, {totalQty: number, hasShortage: boolean}>();
    const getChildrenQuick = (id: number): number[] => {
      const children = flatLocations.filter(l => l.parent_id === id).map(l => l.id);
      let all = [id, ...children];
      children.forEach(c => { all = [...all, ...getChildrenQuick(c)] });
      return all;
    };
    flatLocations.forEach(loc => {
      let totalQty = 0; let hasShortage = false;
      const relIds = getChildrenQuick(loc.id);
      allItems.forEach(item => {
        if (item.location_ids?.some(id => relIds.includes(id))) {
          totalQty += item.quantity;
          if (item.quantity < 5) hasShortage = true;
        }
      });
      stats.set(loc.id, { totalQty, hasShortage });
    });
    return stats;
  }, [flatLocations, allItems]);

  const openEditModal = (loc: StorageLocation) => {
      setIsEditMode(true); setEditingId(loc.id);
      setForm({ name: loc.name, type: loc.type, parent_id: loc.parent_id ? loc.parent_id.toString() : 'none', barcode: loc.barcode || '', description: loc.description || '', max_capacity: loc.max_capacity || 100 });
      setIsModalOpen(true);
  };

  const openAddModal = () => {
      setIsEditMode(false); setEditingId(null);
      setForm({ name: '', type: 'Box', parent_id: 'none', barcode: '', description: '', max_capacity: 100 });
      setIsModalOpen(true);
  };

  const handleSaveLocation = async () => {
    if (!form.name || !form.type) return;
    const url = isEditMode && editingId ? apiUrl(`/api/admin/locations/${editingId}`) : apiUrl('/api/admin/locations');
    const method = isEditMode ? 'PUT' : 'POST';
    const isRootType = ['Room', 'Zone'].includes(form.type);

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
        body: JSON.stringify({ name: form.name, type: form.type, parent_id: isRootType || form.parent_id === 'none' ? null : parseInt(form.parent_id), barcode: form.barcode || `LOC-${Date.now().toString().slice(-6)}`, description: form.description, max_capacity: form.max_capacity })
      });
      if (res.ok) { toast({ title: isEditMode ? t('تم التعديل بنجاح ✏️', 'Edited successfully ✏️') : t('تم الإضافة بنجاح ✅', 'Added successfully ✅') }); setIsModalOpen(false); fetchLocationsAndItems(); }
      else { const errorData = await res.json(); toast({ title: t('خطأ', 'Error'), description: errorData.message, variant: 'destructive' }); }
    } catch (error) { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const handleDeleteLocation = async (locId: number) => {
    if (!confirm(t('تأكيد مسح الموقع؟', 'Confirm deletion?'))) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/locations/${locId}`), { method: 'DELETE', headers: { 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') } });
      const data = await res.json();
      if (res.ok) { toast({ title: t('تم الحذف 🗑️', 'Deleted 🗑️') }); if (selectedLoc?.id === locId) setSelectedLoc(null); fetchLocationsAndItems(); }
      else { toast({ title: t('غير مسموح', 'Not allowed'), description: data.message, variant: 'destructive' }); }
    } catch (error) { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const handleStartAudit = () => {
      setAuditItems(locItems.map(i => ({ name: i.name || '', original: i.quantity, current: i.quantity })));
      setIsAuditOpen(true);
  };

  const submitAudit = async () => {
      let successCount = 0;
      for (const item of auditItems) {
          if (item.original !== item.current) {
              const fullItemData = allItems.find(i => i.name === item.name);
              if(!fullItemData) continue;
              await fetch(apiUrl('/api/admin/items'), {
                  method: 'POST', headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
                  body: JSON.stringify({...fullItemData, quantity: item.current, original_name_ar: fullItemData.name})
              });
              successCount++;
          }
      }
      toast({ title: t('تم الجرد ✅', 'Audit Complete ✅'), description: `تم تحديث ${successCount} قطع.` });
      setIsAuditOpen(false); fetchLocationsAndItems();
  };

  const printBarcodeLabel = (loc: StorageLocation) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${loc.barcode}&code=Code128&translate-esc=on`;
    const fullPath = getFullLocationPath(loc.id);
    const htmlContent = `
      <html>
        <head>
          <title>Print Label - ${loc.name}</title>
          <style>
            @page { margin: 0; size: auto; }
            body { font-family: Arial, Helvetica, sans-serif; text-align: center; margin: 0; padding: 1mm 2mm; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 22mm; background-color: white; color: black; overflow: hidden; }
            .label-box { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
            h2 { margin: 0 0 1px 0; font-size: 11px; font-weight: 900; white-space: nowrap; }
            img { width: auto; height: 16mm; max-width: 100%; object-fit: contain; }
          </style>
        </head>
        <body><div class="label-box"><h2>${fullPath}</h2><img src="${barcodeUrl}" alt="Barcode" /></div><script>setTimeout(() => { window.print(); window.close(); }, 1000);</script></body>
      </html>`;
    printWindow.document.write(htmlContent); printWindow.document.close();
  };

  // 🌟 شجرة الخريطة (مغلقة افتراضياً بناء على طلبك)
  const TreeNode = ({ node, depth = 0 }: { node: StorageLocation, depth?: number }) => {
    const [expanded, setExpanded] = useState(false); // مغلق افتراضياً 🌟
    const hasChildren = node.children && node.children.length > 0;
    const stats = locationStatsMap.get(node.id) || { totalQty: 0, hasShortage: false };
    const fillPercentage = Math.min((stats.totalQty / (node.max_capacity || 100)) * 100, 100);

    return (
      <div className="w-full" onDragOver={(e) => { e.preventDefault(); setDragOverId(node.id); }} onDragLeave={() => setDragOverId(null)} onDrop={(e) => handleDrop(e, node.id)}>
        <div draggable onDragStart={(e) => e.dataTransfer.setData('loc_id', node.id.toString())} onClick={() => handleSelectLocation(node)}
          className={`flex flex-col p-2.5 rounded-lg cursor-pointer transition-all border-2 
            ${selectedLoc?.id === node.id ? 'bg-blue-50 border-blue-500 shadow-md dark:bg-blue-900/20' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}
            ${dragOverId === node.id ? 'border-dashed border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 scale-[1.02]' : ''}`}
          style={{ paddingLeft: lang === 'en' ? `${depth * 20 + 10}px` : '10px', paddingRight: lang === 'ar' ? `${depth * 20 + 10}px` : '10px' }}
        >
          <div className="flex items-center gap-2 w-full">
            <div onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="w-5 h-5 flex items-center justify-center opacity-70 hover:opacity-100">
              {hasChildren ? (expanded ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className={`w-4 h-4 ${lang==='ar'?'rotate-180':''}`}/>) : <span className="w-4 h-4"></span>}
            </div>
            <GripVertical className="w-3 h-3 text-slate-300 cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100 shrink-0" />
            {getIcon(node.type)}
            <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate flex-1">{node.name}</span>
            {stats.hasShortage && <span title={t('نقص في المخزون الفرعي', 'Low stock inside')}><AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse shrink-0" /></span>}
          </div>
          {(['Box', 'Bin', 'Drawer', 'Shelf'].includes(node.type)) && (
            <div className="mt-2 flex items-center gap-2 pl-10 pr-2 opacity-80">
                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${fillPercentage > 90 ? 'bg-red-500' : fillPercentage > 60 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{width: `${fillPercentage}%`}}></div></div>
                <span className="text-[9px] font-bold text-slate-400">{stats.totalQty}/{node.max_capacity}</span>
            </div>
          )}
        </div>
        {expanded && hasChildren && <div className="w-full">{node.children!.map(child => <TreeNode key={child.id} node={child} depth={depth + 1} />)}</div>}
      </div>
    );
  };

  // 🌟 شجرة لاختيار "الأب" في نافذة التعديل (مغلقة افتراضياً)
  const ParentPickerNode = ({ node }: { node: StorageLocation }) => {
    const [expanded, setExpanded] = useState(false);
    if (editingId === node.id) return null; // منع اختيار الموقع كأب لنفسه
    const hasChildren = node.children && node.children.some(c => c.id !== editingId);
    const isSelected = form.parent_id === node.id.toString();

    return (
        <div className="w-full">
            <div className="flex items-center gap-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md px-2 transition-colors">
                <div onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="w-6 h-6 flex items-center justify-center cursor-pointer bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    {hasChildren ? (expanded ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className={`w-4 h-4 ${lang==='ar'?'rotate-180':''}`}/>) : <span className="w-4 h-4"></span>}
                </div>
                <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => {
                        setForm({...form, parent_id: node.id.toString()});
                        setIsParentPickerOpen(false);
                    }}>
                    {getIcon(node.type)}
                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{node.name}</span>
                    <span className="text-[10px] text-slate-400">({node.type})</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-auto ml-auto" />}
                </div>
            </div>
            {expanded && hasChildren && (
                <div style={{ marginInlineStart: '12px', borderInlineStart: '2px solid #e2e8f0', paddingInlineStart: '8px' }} className="mt-1 dark:border-slate-800">
                    {node.children!.map(child => <ParentPickerNode key={child.id} node={child} />)}
                </div>
            )}
        </div>
    );
  };

  const selectedChildren = selectedLoc ? flatLocations.filter(l => l.parent_id === selectedLoc.id) : [];

  return (
    <div className="space-y-6 font-sans pb-10 transition-colors" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 border-b border-slate-200 dark:border-slate-800 pb-4 transition-colors">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Map className="w-7 h-7 text-blue-600" /> {t('مستكشف مواقع التخزين', 'WMS Explorer')}
          </h2>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">{t('اسحب المواقع لنقلها، وراقب سعة الصناديق', 'Drag to move locations, monitor box capacities')}</p>
        </div>
        <Button onClick={openAddModal} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-transform active:scale-95 h-10">
          <Plus className="w-4 h-4" /> {t('إضافة موقع جديد', 'Add New Location')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm h-[650px] flex flex-col overflow-hidden transition-colors"
              onDragOver={(e) => { e.preventDefault(); setDragOverId(0); }} onDragLeave={() => setDragOverId(null)} onDrop={(e) => handleDrop(e, null)}>
          <div className={`p-4 border-b border-slate-100 dark:border-slate-800 transition-colors ${dragOverId === 0 ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-slate-50 dark:bg-slate-950'}`}>
             <h3 className="font-black text-slate-700 dark:text-slate-300 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-500"/> {t('هيكل المعمل (الجذر)', 'Lab Root Structure')}</h3>
             <p className="text-[10px] font-bold text-slate-400 mt-1">{t('أفلت هنا لفك ارتباط الموقع', 'Drop here to make independent')}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            {loading ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
            : locations.map(loc => <TreeNode key={loc.id} node={loc} />)}
          </div>
        </Card>

        <Card className="lg:col-span-2 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm h-[650px] flex flex-col overflow-hidden transition-colors relative">
          {!selectedLoc ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-50">
              <Inbox className="w-24 h-24 text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-2xl font-black text-slate-500 dark:text-slate-400">{t('حدد موقعاً من القائمة', 'Select a location from the list')}</h3>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0 transition-colors">
                 <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-4">
                   <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md flex items-center gap-1">{getIcon(selectedLoc.type, "w-3 h-3")} {selectedLoc.type}</span>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">ID: {selectedLoc.id}</span>
                     </div>
                     <p className="text-xs font-bold text-blue-500 mt-2">{getFullLocationPath(selectedLoc.id)}</p>
                     <p className="text-sm font-medium text-slate-500 mt-1">{selectedLoc.description || t('لا يوجد وصف', 'No description')}</p>
                   </div>

                   <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                     <Button onClick={() => openEditModal(selectedLoc)} variant="outline" className="font-bold text-blue-600 border-blue-200 hover:bg-blue-50"><Pencil className="w-4 h-4 mr-1"/> {t('تعديل', 'Edit')}</Button>
                     <Button onClick={() => printBarcodeLabel(selectedLoc)} variant="outline" className="font-bold text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"><Printer className="w-4 h-4 text-emerald-600 mr-1"/> {t('طباعة', 'Print')}</Button>
                     <Button onClick={handleStartAudit} disabled={locItems.length === 0} className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white"><ClipboardCheck className="w-4 h-4 mr-1"/> {t('الجرد التراكمي', 'Audit Area')}</Button>
                     <Button onClick={() => handleDeleteLocation(selectedLoc.id)} variant="outline" className="text-red-500 border-red-200 hover:bg-red-50 px-3"><Trash2 className="w-4 h-4"/></Button>
                   </div>
                 </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-slate-900/50 space-y-6">
                 {selectedChildren.length > 0 && (
                     <div>
                         <h3 className="font-black text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2 text-sm"><Layers className="w-4 h-4 text-orange-500"/> {t('الأماكن المتفرعة من هذا الموقع:', 'Sub-locations inside:')}</h3>
                         <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                             {selectedChildren.map(child => (
                                 <div key={child.id} onClick={() => handleSelectLocation(child)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl cursor-pointer hover:border-blue-400 hover:shadow-md transition-all flex items-center gap-3">
                                     <div className="bg-slate-100 dark:bg-slate-900 p-2 rounded-lg">{getIcon(child.type, "w-5 h-5")}</div>
                                     <div className="min-w-0 flex-1"><p className="font-bold text-sm truncate text-slate-800 dark:text-slate-200">{child.name}</p><p className="text-[10px] text-slate-400">{child.type}</p></div>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}

                 <div>
                    <h3 className="font-black text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2 text-sm pt-4 border-t border-slate-200 dark:border-slate-800"><Package className="w-4 h-4 text-blue-500"/> {t('إجمالي القطع في هذا الموقع (ومحتوياته):', 'Total items in this location (and sub-locations):')}</h3>
                    {locItems.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center text-slate-500 dark:text-slate-400 font-bold">{t('لا توجد أي قطع هنا أو في الأماكن التابعة له.', 'No items found here or in its sub-locations.')}</div>
                    ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {locItems.map((item, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-900 p-1 shrink-0 flex items-center justify-center"><img src={item.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png'} className="max-w-full max-h-full object-contain" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }} /></div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm truncate">{lang === 'ar' ? (item.name_ar || item.name_en) : (item.name_en || item.name_ar)}</p>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded mt-1 inline-block border ${item.quantity < 5 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{t('الكمية:', 'Qty:')} {item.quantity}</span>
                            </div>
                        </div>
                        ))}
                    </div>
                    )}
                 </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md font-sans p-0 overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-800"><DialogTitle className="text-xl font-black flex items-center gap-2 dark:text-white">{isEditMode ? <Pencil className="w-6 h-6 text-blue-600" /> : <Plus className="w-6 h-6 text-blue-600" />} {isEditMode ? t('تعديل بيانات الموقع', 'Edit Location') : t('إضافة موقع جديد', 'Add Location')}</DialogTitle></DialogHeader>
          <div className="space-y-4 p-6">
            <div className="space-y-1.5"><Label className="font-bold dark:text-slate-300">{t('اسم الموقع', 'Location Name')}</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-white" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-bold dark:text-slate-300">{t('نوع الموقع', 'Type')}</Label>
                <Select value={form.type} onValueChange={(val: LocType) => setForm({...form, type: val, parent_id: ['Room', 'Zone'].includes(val) ? 'none' : form.parent_id})}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-white" dir={lang === 'ar' ? 'rtl' : 'ltr'}><SelectValue /></SelectTrigger>
                  <SelectContent dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                    <SelectGroup><SelectLabel className="bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs">{t('أماكن رئيسية', 'Main')}</SelectLabel><SelectItem value="Room">{t('غرفة (Room)', 'Room')}</SelectItem><SelectItem value="Zone">{t('منطقة (Zone)', 'Zone')}</SelectItem></SelectGroup>
                    <SelectGroup><SelectLabel className="bg-slate-100 dark:bg-slate-800 px-2 py-1 mt-2 text-xs">{t('وحدات كبرى', 'Large')}</SelectLabel><SelectItem value="Cabinet">{t('دولاب (Cabinet)', 'Cabinet')}</SelectItem><SelectItem value="Rack">{t('حامل/استاند (Rack)', 'Rack')}</SelectItem></SelectGroup>
                    <SelectGroup><SelectLabel className="bg-slate-100 dark:bg-slate-800 px-2 py-1 mt-2 text-xs">{t('وحدات صغرى', 'Small')}</SelectLabel><SelectItem value="Shelf">{t('رف (Shelf)', 'Shelf')}</SelectItem><SelectItem value="Drawer">{t('درج (Drawer)', 'Drawer')}</SelectItem><SelectItem value="Box">{t('صندوق (Box)', 'Box')}</SelectItem><SelectItem value="Bin">{t('حاوية (Bin)', 'Bin')}</SelectItem></SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {/* 🌟 مكان منتقي الشجرة لاختيار الأب 🌟 */}
              <div className="space-y-1.5">
                <Label className="font-bold text-xs dark:text-slate-300">{t('الموقع الأب', 'Parent')}</Label>
                <Button type="button" variant="outline" onClick={() => setIsParentPickerOpen(true)} className={`h-10 w-full justify-start overflow-hidden text-ellipsis whitespace-nowrap border-dashed ${['Room', 'Zone'].includes(form.type) ? 'bg-slate-200 dark:bg-slate-800 opacity-50 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-950 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700'}`} disabled={['Room', 'Zone'].includes(form.type)}>
                  {form.parent_id !== 'none' ? getFullLocationPath(parseInt(form.parent_id)) : t('-- مستقل (بدون أب) --', '-- Independent --')}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1.5"><Label className="font-bold text-xs dark:text-slate-300">{t('السعة القصوى', 'Capacity')}</Label><Input type="number" min="1" value={form.max_capacity} onChange={e => setForm({...form, max_capacity: parseInt(e.target.value) || 100})} className="bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-white" disabled={['Room', 'Zone'].includes(form.type)} /></div>
               <div className="space-y-1.5"><Label className="font-bold text-xs dark:text-slate-300">{t('باركود', 'Barcode')}</Label><Input value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} placeholder="Auto" className="bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-white font-mono" dir="ltr" /></div>
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 flex sm:justify-between"><Button variant="outline" onClick={() => setIsModalOpen(false)} className="font-bold h-11 dark:border-slate-700 dark:text-slate-300">{t('إلغاء', 'Cancel')}</Button><Button onClick={handleSaveLocation} disabled={!form.name} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-8">{isEditMode ? t('حفظ التعديلات', 'Save') : t('إضافة الموقع', 'Add')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🌟 نافذة منتقي شجرة المواقع لاختيار الأب 🌟 */}
      <Dialog open={isParentPickerOpen} onOpenChange={setIsParentPickerOpen}>
         <DialogContent className="max-w-md font-sans" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-black text-blue-600"><MapPin className="w-5 h-5"/> {t('اختر الموقع الأب', 'Select Parent Location')}</DialogTitle></DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto py-2 custom-scrollbar pr-2 border-y border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg px-2 cursor-pointer border-b border-slate-100 dark:border-slate-800 mb-2" onClick={() => { setForm({...form, parent_id: 'none'}); setIsParentPickerOpen(false); }}>
                    <Layers className="w-5 h-5 text-slate-400" />
                    <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{t('-- مستقل (موقع جذري بدون أب) --', '-- Independent (Root Location) --')}</span>
                    {form.parent_id === 'none' && <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-auto ml-auto" />}
                </div>
                {locations.map(loc => <ParentPickerNode key={loc.id} node={loc} />)}
            </div>
            <DialogFooter>
                <Button onClick={() => setIsParentPickerOpen(false)} className="w-full font-bold bg-blue-600 text-white">{t('إغلاق', 'Close')}</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <Dialog open={isAuditOpen} onOpenChange={setIsAuditOpen}>
        <DialogContent className="max-w-md font-sans" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle className="text-xl font-black flex items-center gap-2 text-emerald-600"><ClipboardCheck className="w-6 h-6" /> {t('جرد التراكمي لـ:', 'Audit Area:')} {selectedLoc?.name}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
             {auditItems.map((item, idx) => (
                 <div key={idx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-sm flex-1 truncate pr-3">{item.name}</span>
                    <div className="flex items-center gap-2"><span className="text-xs text-slate-400 font-bold">{t('الفعلي:', 'Actual:')}</span><Input type="number" min="0" value={item.current} onChange={(e) => { const newItems = [...auditItems]; newItems[idx].current = parseInt(e.target.value) || 0; setAuditItems(newItems); }} className="w-20 h-9 font-black text-center" /></div>
                 </div>
             ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsAuditOpen(false)} className="font-bold w-full sm:w-auto">{t('إلغاء', 'Cancel')}</Button><Button onClick={submitAudit} disabled={auditItems.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold w-full sm:w-auto"><CheckCircle2 className="w-4 h-4 mr-1" /> {t('تحديث الكميات', 'Update Quantities')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AdminLocations;