import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus,
  FileText,
  Search,
  CheckCircle2,
  Trash2,
  Users,
  ShoppingCart,
  Minus,
  Settings2,
  Package,
  MapPin,
  Layers,
  ThumbsUp,
  Wrench,
  ChevronDown,
  ChevronRight,
  Home,
  AlignJustify,
  Archive,
  ShoppingBasket,
  Server,
  Map,
  X,
  Bell,
  ScanLine,
  TextCursorInput
} from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '../../LanguageContext';
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

interface Loan {
  id: number;
  studentId: string;
  studentName: string;
  componentName: string;
  quantity: number;
  borrowDate: string;
  expectedReturnDate: string;
  status: string;
}

interface GroupedStudent {
  studentId: string;
  studentName: string;
  loans: Loan[];
  activeCount: number;
  overallStatus: 'active' | 'overdue' | 'returned';
}

interface ApiUser { universityId: string; name: string; role: string; }
interface Device { name?: string; name_ar?: string; name_en?: string; quantity: number; category?: string; category_ar?: string; category_en?: string; location?: string; location_ids?: number[]; imageUrl: string; original_name_ar?: string; }
interface SelectedItem { comp: Device; qty: number; }
type FilterType = 'all' | 'active' | 'overdue' | 'returned';

const AdminLoans = () => {
  const { lang, t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme } = useTheme();

  const isSuperAdmin = user?.role === 'مشرف' || user?.role?.toLowerCase() === 'admin';
  const [sendingReminders, setSendingReminders] = useState(false);
  const [groupedStudents, setGroupedStudents] = useState<GroupedStudent[]>([]);
  const [students, setStudents] = useState<ApiUser[]>([]);
  const [inventory, setInventory] = useState<Device[]>([]);
  const [flatLocations, setFlatLocations] = useState<StorageLocation[]>([]);
  const [locationTree, setLocationTree] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<FilterType>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [selectedStudentForManage, setSelectedStudentForManage] = useState<GroupedStudent | null>(null);

  const [returnConditionOpen, setReturnConditionOpen] = useState(false);
  const [selectedLoanToReturn, setSelectedLoanToReturn] = useState<Loan | null>(null);
  const [selectedLoanIds, setSelectedLoanIds] = useState<number[]>([]);
  const [bulkReturnOpen, setBulkReturnOpen] = useState(false);
  const [sendingReturnRequest, setSendingReturnRequest] = useState(false);

  const [studentSearch, setStudentSearch] = useState('');
  const [foundStudent, setFoundStudent] = useState<ApiUser | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [returnDate, setReturnDate] = useState('');

  const [searchQ, setSearchQ] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [isLocPickerOpen, setIsLocPickerOpen] = useState(false);
  const [selectedLocFilter, setSelectedLocFilter] = useState<number | null>(null); // فلتر الموقع المحدد من الشجرة
  const [isScannerOpenInLoan, setIsScannerOpenInLoan] = useState(false);

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
      const [loansRes, usersRes, itemsRes, locsRes] = await Promise.all([
        fetch(apiUrl('/api/loans')),
        fetch(apiUrl('/api/users')),
        fetch(apiUrl('/api/items')),
        fetch(apiUrl('/api/admin/locations'))
      ]);

      if (loansRes.ok) {
        const allLoans: Loan[] = (await loansRes.json()).data;
        const groups = new globalThis.Map<string, GroupedStudent>();
        allLoans.forEach(loan => {
          if (!groups.has(loan.studentId)) groups.set(loan.studentId, { studentId: loan.studentId, studentName: loan.studentName, loans: [], activeCount: 0, overallStatus: 'returned' });
          const group = groups.get(loan.studentId)!;
          group.loans.push(loan);
          const isOverdue = loan.status === 'متأخر' || loan.status === 'Overdue' ||
            ((loan.status === 'نشط' || loan.status === 'Active') &&
             loan.expectedReturnDate && (() => {
               try {
                 const raw = loan.expectedReturnDate.trim();
                 // normalize separators → always use -
                 const normalized = raw.replace(/\//g, '-');
                 // detect format: if starts with day (DD-MM-YYYY) reorder
                 const parts = normalized.split('-');
                 let d: Date;
                 if (parts.length === 3 && parts[0].length <= 2 && parseInt(parts[0]) <= 31 && parseInt(parts[2]) > 31) {
                   // DD-MM-YYYY → YYYY-MM-DD
                   d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
                 } else {
                   // YYYY-MM-DD or YYYY-M-D
                   d = new Date(`${parts[0]}-${(parts[1]||'01').padStart(2,'0')}-${(parts[2]||'01').padStart(2,'0')}`);
                 }
                 // compare date only (ignore time)
                 const today = new Date(); today.setHours(0,0,0,0);
                 return d < today && !isNaN(d.getTime());
               } catch { return false; }
             })());
          const isActive = !isOverdue && (loan.status === 'نشط' || loan.status === 'Active');
          if (isActive || isOverdue) group.activeCount += 1;
          if (isOverdue) group.overallStatus = 'overdue';
          else if (isActive && group.overallStatus !== 'overdue') group.overallStatus = 'active';
        });
        setGroupedStudents(Array.from(groups.values()));
        if (selectedStudentForManage) setSelectedStudentForManage(groups.get(selectedStudentForManage.studentId) || null);
      }

      if (usersRes.ok) setStudents((await usersRes.json()).data.filter((u: ApiUser) => u.role === 'طالب' || u.role === 'student' || u.role === 'مهندس'));
      if (itemsRes.ok) setInventory((await itemsRes.json()).data);
      if (locsRes.ok) {
          const locData = (await locsRes.json()).data;
          setFlatLocations(locData);
          setLocationTree(buildTree(locData));
      }

    } catch (error) { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // ✅ إرسال تذكيرات للعهد المتأخرة
  const handleSendReminders = async () => {
    setSendingReminders(true);
    try {
      const res = await fetch(apiUrl('/api/admin/send-overdue-reminders'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'admin-id': user?.id || '',
          'admin-name': encodeURIComponent(user?.name || '')
        }
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: t('تم الإرسال ✅', 'Reminders Sent ✅'),
          description: t(`تم إرسال ${data.sent} تذكير، تخطي ${data.skipped} (بدون إيميل)`,
                         `Sent ${data.sent} reminders, skipped ${data.skipped} (no email)`)
        });
      } else {
        toast({ title: t('خطأ', 'Error'), description: data.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' });
    } finally {
      setSendingReminders(false);
    }
  };

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

  const getChildIds = (id: number): number[] => {
    const children = flatLocations.filter(l => l.parent_id === id).map(l => l.id);
    let all = [id, ...children];
    children.forEach(c => { all = [...all, ...getChildIds(c)] });
    return all;
  };

  const processBarcodeLoan = (barcodeText: string) => {
    const formatted = barcodeText.trim().toUpperCase();
    const found = flatLocations.find(l => l.barcode.toUpperCase() === formatted);
    if (found) {
      setSelectedLocFilter(found.id);
      setIsScannerOpenInLoan(false);
      toast({ title: t('تم تحديد الموقع 📦', 'Location set 📦'), description: getFullLocationPath(found.id) || found.name });
    } else {
      toast({ title: t('غير معروف', 'Unknown'), description: t('هذا الباركود غير مسجل', 'Barcode not registered'), variant: 'destructive' });
    }
  };

  const filteredGroups = groupedStudents.filter(g => {
    if (filter === 'all') return true;
    if (filter === 'active') return g.overallStatus === 'active';
    if (filter === 'overdue') return g.overallStatus === 'overdue';
    if (filter === 'returned') return g.overallStatus === 'returned';
    return true;
  });

  const allCategories = lang === 'ar' ? ['All', ...Array.from(new Set(inventory.map(item => getCatAr(item)).filter(Boolean)))] : ['All', ...Array.from(new Set(inventory.map(item => getCatEn(item)).filter(Boolean)))];

  const filteredComps = useMemo(() => {
    return inventory.filter(c => {
      const searchLower = searchQ.toLowerCase();
      const matchesSearch = getNameAr(c).toLowerCase().includes(searchLower) || getNameEn(c).toLowerCase().includes(searchLower);
      const matchesCategory = selectedCategory === 'All' || getCatAr(c) === selectedCategory || getCatEn(c) === selectedCategory;

      // الفلترة بالمكان (إذا تم تحديد موقع من الشجرة)
      let matchesLocation = true;
      if (selectedLocFilter !== null) {
          const relevantIds = getChildIds(selectedLocFilter);
          matchesLocation = c.location_ids?.some(id => relevantIds.includes(id)) || false;
      }

      return c.quantity > 0 && matchesSearch && matchesCategory && matchesLocation;
    });
  }, [inventory, searchQ, selectedCategory, selectedLocFilter, lang]);

  const toggleItemInCart = (comp: Device) => {
    const exists = selectedItems.find(i => getNameAr(i.comp) === getNameAr(comp));
    if (exists) setSelectedItems(prev => prev.filter(i => getNameAr(i.comp) !== getNameAr(comp)));
    else setSelectedItems(prev => [...prev, { comp, qty: 1 }]);
  };

  const updateItemQty = (compName: string, delta: number) => {
    setSelectedItems(prev => prev.map(item => {
      if (getNameAr(item.comp) === compName) {
        const newQty = item.qty + delta;
        if (newQty > 0 && newQty <= item.comp.quantity) return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const resetDialog = () => {
    setDialogOpen(false); setStudentSearch(''); setFoundStudent(null); setSelectedItems([]); setReturnDate(''); setSearchQ(''); setSelectedCategory('All'); setSelectedLocFilter(null);
  };

  const handleAddLoan = async () => {
    if (!foundStudent || selectedItems.length === 0 || !returnDate) return;
    try {
      await Promise.all(selectedItems.map(item =>
        fetch(apiUrl('/api/loans'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
          body: JSON.stringify({ studentId: foundStudent.universityId, itemName: getNameAr(item.comp), quantity: item.qty, returnDate: returnDate })
        })
      ));
      toast({ title: t('تم تسجيل العهد بنجاح ✅', 'Loans Registered ✅') });
      resetDialog(); fetchData();
    } catch (error) { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const handleReturnAction = async (condition: 'good' | 'damaged') => {
    if (!selectedLoanToReturn) return;
    try {
      const res = await fetch(apiUrl(`/api/loans/return/${selectedLoanToReturn.id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
        body: JSON.stringify({ itemName: selectedLoanToReturn.componentName, quantity: selectedLoanToReturn.quantity, condition: condition })
      });
      if (res.ok) {
        const toastMsg = condition === 'good'
          ? t('تم إرجاع القطعة للمخزون ✅', 'Returned to stock ✅')
          : t('تم تحويل القطعة للصيانة 🔧', 'Sent to maintenance 🔧');
        toast({ title: toastMsg });

        // ✅ إرسال إيميل للطالب بتأكيد الإرجاع
        try {
          const studentGroup = groupedStudents.find(g => g.loans.some(l => l.id === selectedLoanToReturn.id));
          if (studentGroup) {
            const usersRes = await fetch(apiUrl('/api/users'));
            if (usersRes.ok) {
              const usersData = await usersRes.json();
              const studentUser = usersData.data?.find((u: {universityId: string; email?: string; name: string}) => u.universityId === studentGroup.studentId);
              if (studentUser?.email) {
                const subject = condition === 'good'
                  ? t('تأكيد إرجاع القطعة ✅', 'Item Return Confirmed ✅')
                  : t('تأكيد إرجاع القطعة — تحويل للصيانة 🔧', 'Item Return — Sent to Maintenance 🔧');
                const body = condition === 'good'
                  ? t(
                      `مرحباً ${studentUser.name}،

تم استلام القطعة التالية وإعادتها للمخزون بنجاح:
• القطعة: ${selectedLoanToReturn.componentName}
• الكمية: ${selectedLoanToReturn.quantity}
• الحالة: سليمة ✅

شكراً لالتزامك.`,
                      `Hello ${studentUser.name},

The following item has been returned to stock successfully:
• Item: ${selectedLoanToReturn.componentName}
• Qty: ${selectedLoanToReturn.quantity}
• Condition: Good ✅

Thank you for your commitment.`
                    )
                  : t(
                      `مرحباً ${studentUser.name}،

تم استلام القطعة التالية وتحويلها لقسم الصيانة:
• القطعة: ${selectedLoanToReturn.componentName}
• الكمية: ${selectedLoanToReturn.quantity}
• الحالة: تحتاج صيانة 🔧

يرجى التواصل مع مشرف المعمل لمزيد من التفاصيل.`,
                      `Hello ${studentUser.name},

The following item has been received and sent to maintenance:
• Item: ${selectedLoanToReturn.componentName}
• Qty: ${selectedLoanToReturn.quantity}
• Condition: Needs Repair 🔧

Please contact the lab admin for more details.`
                    );
                await fetch(apiUrl('/api/admin/send-custom-email'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
                  body: JSON.stringify({ to: studentUser.email, subject, body })
                });
              }
            }
          }
        } catch { /* email failure is non-critical */ }

        setReturnConditionOpen(false); setSelectedLoanToReturn(null); fetchData();
      }
    } catch (error) { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const openReturnModal = (loan: Loan) => { setSelectedLoanToReturn(loan); setReturnConditionOpen(true); };

  // ✅ إرجاع متعدد دفعة وحدة
  const handleBulkReturn = async (condition: 'good' | 'damaged') => {
    if (selectedLoanIds.length === 0 || !selectedStudentForManage) return;
    const loansToReturn = selectedStudentForManage.loans.filter(l => selectedLoanIds.includes(l.id));
    try {
      await Promise.all(loansToReturn.map(loan =>
        fetch(apiUrl(`/api/loans/return/${loan.id}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
          body: JSON.stringify({ itemName: loan.componentName, quantity: loan.quantity, condition })
        })
      ));

      // إيميل واحد فيه كل القطع
      try {
        const usersRes = await fetch(apiUrl('/api/users'));
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const studentUser = usersData.data?.find((u: {universityId: string; email?: string; name: string}) => u.universityId === selectedStudentForManage.studentId);
          if (studentUser?.email) {
            const itemsList = loansToReturn.map(l => `• ${l.componentName} (x${l.quantity})`).join('\n');
            const subject = condition === 'good'
              ? t('تأكيد إرجاع القطع ✅', 'Items Return Confirmed ✅')
              : t('تأكيد إرجاع القطع — تحويل للصيانة 🔧', 'Items Return — Sent to Maintenance 🔧');
            const body = condition === 'good'
              ? t(
                  `مرحباً ${studentUser.name}،

تم استلام القطع التالية وإعادتها للمخزون بنجاح:
${itemsList}

الحالة: سليمة ✅
شكراً لالتزامك.`,
                  `Hello ${studentUser.name},

The following items have been returned to stock successfully:
${itemsList}

Condition: Good ✅
Thank you for your commitment.`
                )
              : t(
                  `مرحباً ${studentUser.name}،

تم استلام القطع التالية وتحويلها لقسم الصيانة:
${itemsList}

الحالة: تحتاج صيانة 🔧
يرجى التواصل مع مشرف المعمل لمزيد من التفاصيل.`,
                  `Hello ${studentUser.name},

The following items have been received and sent to maintenance:
${itemsList}

Condition: Needs Repair 🔧
Please contact the lab admin for more details.`
                );
            await fetch(apiUrl('/api/admin/send-custom-email'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
              body: JSON.stringify({ to: studentUser.email, subject, body })
            });
          }
        }
      } catch { /* email failure is non-critical */ }

      toast({ title: t(`تم إرجاع ${loansToReturn.length} قطعة ✅`, `${loansToReturn.length} items returned ✅`) });
      setBulkReturnOpen(false);
      setSelectedLoanIds([]);
      fetchData();
    } catch { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  // ✅ طلب إرجاع — إرسال إيميل للطالب
  const handleRequestReturn = async () => {
    if (selectedLoanIds.length === 0 || !selectedStudentForManage) return;
    setSendingReturnRequest(true);
    try {
      const loansToRequest = selectedStudentForManage.loans.filter(l => selectedLoanIds.includes(l.id));
      const usersRes = await fetch(apiUrl('/api/users'));
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const studentUser = usersData.data?.find((u: {universityId: string; email?: string; name: string}) => u.universityId === selectedStudentForManage.studentId);
        if (studentUser?.email) {
          const itemsList = loansToRequest.map(l => `• ${l.componentName} (x${l.quantity}) — الإرجاع: ${l.expectedReturnDate}`).join('\n');
          const subject = t('طلب إرجاع قطع — معمل أكاديمية طويق 🔔', 'Item Return Request — Tuwaiq Lab 🔔');
          const body = lang === 'ar'
            ? `مرحباً ${studentUser.name}،\n\nنحتاج منك إرجاع القطع التالية في أقرب وقت ممكن:\n\n${itemsList}\n\nيرجى التوجه لمشرف المعمل لتسليم القطع.\n\nشكراً لتعاونك.`
            : `Hello ${studentUser.name},\n\nWe need you to return the following items as soon as possible:\n\n${itemsList}\n\nPlease come to the lab supervisor to return the items.\n\nThank you for your cooperation.`;
          const res = await fetch(apiUrl('/api/admin/send-custom-email'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') },
            body: JSON.stringify({ to: studentUser.email, subject, body })
          });
          if (res.ok) {
            toast({ title: t('تم إرسال الطلب ✅', 'Request Sent ✅'), description: t(`أُرسل طلب إرجاع ${loansToRequest.length} قطعة لـ ${studentUser.name}`, `Return request for ${loansToRequest.length} items sent to ${studentUser.name}`) });
            setSelectedLoanIds([]);
          } else {
            toast({ title: t('خطأ', 'Error'), description: t('فشل إرسال الإيميل', 'Email failed'), variant: 'destructive' });
          }
        } else {
          toast({ title: t('لا يوجد إيميل', 'No Email'), description: t('الطالب ليس لديه إيميل مسجل', 'Student has no email registered'), variant: 'destructive' });
        }
      }
    } catch { toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' }); }
    finally { setSendingReturnRequest(false); }
  };

  const handleDeleteSingleItem = async (loanId: number) => {
    if (!confirm(t('هل أنت متأكد من حذف هذا السجل نهائياً؟ سيتم إعادة الكمية للمخزون.', 'Delete permanently? Quantity will return to stock.'))) return;
    try {
      const res = await fetch(apiUrl(`/api/loans/${loanId}`), { method: 'DELETE', headers: { 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') } });
      if (res.ok) { toast({ title: t('تم الحذف بنجاح', 'Deleted successfully') }); fetchData(); }
    } catch (error) { toast({ title: t('خطأ', 'Error'), variant: 'destructive' }); }
  };

  const handleDeleteAllStudentLoans = async (group: GroupedStudent) => {
    if (!confirm(t('🚨 هل أنت متأكد من حذف جميع سجلات وعهد هذا الطالب نهائياً؟ سيتم إرجاع جميع الكميات للمخزون فوراً.', '🚨 Are you sure you want to completely delete all loans for this student? All quantities will return to stock.'))) return;
    try {
      await Promise.all(group.loans.map(loan => fetch(apiUrl(`/api/loans/${loan.id}`), { method: 'DELETE', headers: { 'admin-id': user?.id || '', 'admin-name': encodeURIComponent(user?.name || '') } })));
      toast({ title: t('تم مسح جميع سجلات الطالب بنجاح 🗑️', 'All records cleared successfully 🗑️') });
      setManageDialogOpen(false); fetchData();
    } catch (error) { toast({ title: t('حدث خطأ أثناء الحذف الكلي', 'Error during bulk deletion'), variant: 'destructive' }); }
  };

  const handleBulkPDF = (group: GroupedStudent) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const isAr = lang === 'ar';
    const currentDate = new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US');
    const htmlContent = `
      <html dir="${isAr ? 'rtl' : 'ltr'}">
        <head>
          <title>${isAr ? 'كشف عهد' : 'Loans Statement'} - ${group.studentName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
            body { font-family: 'Tajawal', sans-serif; padding: 40px; color: #1e293b; background: #fff; }
            .header { text-align: center; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { color: #1d4ed8; margin: 0 0 5px 0; font-weight: 900; font-size: 28px; }
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin-bottom: 30px; display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
            th, td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; text-align: ${isAr ? 'right' : 'left'}; }
            th { background-color: #f1f5f9; color: #334155; font-weight: bold; }
            .status-active { color: #b45309; font-weight: bold; }
            .status-returned { color: #16a34a; font-weight: bold; }
            .signature { margin-top: 60px; display: flex; justify-content: space-between; }
            .sig-box { text-align: center; width: 40%; border-top: 1px solid #cbd5e1; padding-top: 10px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header"><h1>${isAr ? 'كشف عهد وأدوات مستعارة' : 'Borrowed Items Statement'}</h1><p>${isAr ? 'المعمل ' : 'Engineering & Innovation Lab'}</p></div>
          <div class="info-box">
            <div><p><strong>${isAr ? 'اسم المستفيد:' : 'Beneficiary Name:'}</strong> ${group.studentName}</p><p><strong>${isAr ? 'الرقم الأكاديمي:' : 'Academic ID:'}</strong> ${group.studentId}</p></div>
            <div style="text-align: ${isAr ? 'left' : 'right'};"><p><strong>${isAr ? 'التاريخ:' : 'Date:'}</strong> ${currentDate}</p><p><strong>${isAr ? 'إجمالي القطع النشطة:' : 'Total Active Items:'}</strong> <span style="color: #dc2626; font-size: 18px;">${group.activeCount}</span></p></div>
          </div>
          <table>
            <thead><tr><th>#</th><th>${isAr ? 'اسم القطعة' : 'Item Name'}</th><th>${isAr ? 'الكمية' : 'Qty'}</th><th>${isAr ? 'تاريخ الاستلام' : 'Borrow Date'}</th><th>${isAr ? 'تاريخ الإرجاع' : 'Return Date'}</th><th>${isAr ? 'الحالة' : 'Status'}</th></tr></thead>
            <tbody>
              ${group.loans.map((loan, idx) => `<tr><td>${idx + 1}</td><td><strong>${loan.componentName}</strong></td><td>${loan.quantity}</td><td>${loan.borrowDate}</td><td>${loan.expectedReturnDate}</td><td class="${(loan.status === 'مُرجع' || loan.status === 'Returned') ? 'status-returned' : 'status-active'}">${loan.status}</td></tr>`).join('')}
            </tbody>
          </table>
          <div class="signature"><div class="sig-box">${isAr ? 'توقيع المستفيد' : 'Beneficiary Signature'}</div><div class="sig-box">${isAr ? 'توقيع مشرف المعمل' : 'Admin Signature'}</div></div>
          <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent); printWindow.document.close();
  };

  const SkeletonLoader = () => (
    <>
      {[1, 2, 3, 4].map(i => (
        <TableRow key={i} className="border-slate-100 dark:border-slate-800">
          <TableCell><div className="flex items-center gap-3 animate-pulse"><div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full"></div><div className="space-y-2"><div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div><div className="h-2 w-16 bg-slate-200 dark:bg-slate-800 rounded"></div></div></div></TableCell>
          <TableCell><div className="h-6 w-10 bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div></TableCell>
          <TableCell><div className="h-8 w-8 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto animate-pulse"></div></TableCell>
          <TableCell><div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div></TableCell>
          <TableCell><div className="flex justify-center gap-2 animate-pulse"><div className="w-24 h-8 bg-slate-200 dark:bg-slate-800 rounded-md"></div><div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-md"></div></div></TableCell>
        </TableRow>
      ))}
    </>
  );

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
                        setIsLocPickerOpen(false); // إغلاق النافذة بعد الاختيار
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

  return (
    <div className="space-y-6 font-sans pb-10 relative overflow-hidden transition-colors" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 border-b border-slate-200 dark:border-slate-800 pb-4 transition-colors">
        <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
          <FileText className="w-7 h-7 text-blue-600" /> {t('إدارة العهد النشطة', 'Active Loans Management')}
        </h2>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 custom-scrollbar">
            {[{id:'all', label:t('الكل','All')}, {id:'active', label:t('نشطة','Active')}, {id:'overdue', label:t('متأخرة','Overdue')}, {id:'returned', label:t('مكتملة','Completed')}].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id as FilterType)}
                className={`px-4 py-2 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${filter === f.id ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-md border-slate-800 dark:border-slate-600' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md w-full sm:w-auto h-10">
            <Plus className="w-4 h-4" /> {t('تسليم عهدة يدوياً', 'Issue Manual Loan')}
          </Button>

          {/* ✅ زر تذكير المتأخرين */}
          <Button
            onClick={handleSendReminders}
            disabled={sendingReminders}
            className="gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold shadow-md w-full sm:w-auto h-10 transition-all active:scale-95"
          >
            {sendingReminders
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Bell className="w-4 h-4" />}
            {sendingReminders ? t('جاري الإرسال...', 'Sending...') : t('تذكير المتأخرين', 'Remind Overdue')}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm animate-in fade-in duration-500 transition-colors">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-950 transition-colors">
            <TableRow className="border-slate-200 dark:border-slate-800">
              <TableHead className={`font-bold text-slate-600 dark:text-slate-400 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t('المستفيد', 'Beneficiary')}</TableHead>
              <TableHead className={`font-bold text-slate-600 dark:text-slate-400 text-center`}>{t('إجمالي السجلات', 'Total Records')}</TableHead>
              <TableHead className={`font-bold text-slate-600 dark:text-slate-400 text-center`}>{t('القطع النشطة حالياً', 'Active Items')}</TableHead>
              <TableHead className={`font-bold text-slate-600 dark:text-slate-400 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t('الحالة العامة', 'Overall Status')}</TableHead>
              <TableHead className={`font-bold text-slate-600 dark:text-slate-400 text-center`}>{t('إجراءات', 'Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonLoader />
            ) : filteredGroups.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 dark:text-slate-500 font-bold text-lg">{t('لا توجد سجلات', 'No records found')}</TableCell></TableRow>
            ) : (
              filteredGroups.map(group => (
                <TableRow key={group.studentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-400 font-black flex items-center justify-center text-lg">{group.studentName.charAt(0)}</div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-base">{group.studentName}</p>
                        <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border dark:border-slate-700 inline-block">{group.studentId}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-center font-bold text-slate-500 dark:text-slate-400 text-lg">{group.loans.length}</TableCell>

                  <TableCell className="text-center">
                    {group.activeCount > 0 ? (
                       <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-black border border-orange-200 dark:border-orange-800">{group.activeCount}</span>
                    ) : (
                       <span className="text-emerald-500 dark:text-emerald-400 font-bold flex items-center justify-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 w-fit mx-auto px-2 py-1 rounded-md"><CheckCircle2 className="w-4 h-4"/> 0</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-md shadow-sm border flex items-center gap-1 w-fit ${
                      group.overallStatus === 'overdue' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' :
                      group.overallStatus === 'active' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                    }`}>
                      {group.overallStatus === 'overdue' ? t('متأخر في التسليم', 'Has Overdue') : group.overallStatus === 'active' ? t('عهد نشطة', 'Has Active') : t('مكتمل (الذمة مخلية)', 'Cleared')}
                    </span>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="flex justify-center gap-2 flex-wrap">
                      <Button size="sm" onClick={() => { setSelectedStudentForManage(group); setManageDialogOpen(true); }} className="gap-2 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 border border-blue-200 dark:border-blue-900/50 font-bold shadow-sm transition-all h-9">
                        <Settings2 className="w-4 h-4" /> {t('التفاصيل', 'Details')}
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => handleBulkPDF(group)} className="text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 border-slate-200 dark:border-slate-700 h-9 w-9 bg-white dark:bg-slate-800" title={t('طباعة كشف', 'Print Statement')}>
                        <FileText className="w-4 h-4" />
                      </Button>
                      {/* ✅ زر إرجاع — يظهر لأي طالب عنده عهدة نشطة */}
                      {group.activeCount > 0 && (() => {
                        const firstActiveLoan = group.loans.find(l =>
                          l.status !== 'مُرجع' && l.status !== 'Returned' && l.status !== 'صيانة'
                        );
                        return firstActiveLoan ? (
                          <Button size="sm"
                            onClick={() => {
                              setSelectedStudentForManage(group);
                              openReturnModal(firstActiveLoan);
                            }}
                            className={`gap-1.5 font-bold shadow-sm h-9 border ${
                              group.overallStatus === 'overdue'
                                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100'
                                : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                            }`}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {group.overallStatus === 'overdue' ? t('إرجاع متأخر ⚠️', 'Late Return ⚠️') : t('إرجاع', 'Return')}
                          </Button>
                        ) : null;
                      })()}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={manageDialogOpen} onOpenChange={(open) => { setManageDialogOpen(open); if (!open) setSelectedLoanIds([]); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
            <DialogTitle className="text-xl font-black flex items-center justify-between text-slate-800 dark:text-white">
              <span className="flex items-center gap-2"><Package className="w-6 h-6 text-blue-600 dark:text-blue-400" /> {t('سجل العهد للمستفيد:', 'Loans for:')} <span className="text-blue-700 dark:text-blue-400">{selectedStudentForManage?.studentName}</span></span>
            </DialogTitle>
            {/* ✅ شريط الإجراءات عند تحديد قطع */}
            {selectedLoanIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                  {selectedLoanIds.length} {t('قطعة محددة', 'selected')}
                </span>
                <Button size="sm" onClick={() => setBulkReturnOpen(true)}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('إرجاع المحدد', 'Return Selected')}
                </Button>
                <Button size="sm" onClick={handleRequestReturn} disabled={sendingReturnRequest}
                  className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold h-8 text-xs">
                  {sendingReturnRequest
                    ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    : <Bell className="w-3.5 h-3.5" />}
                  {t('طلب إرجاع', 'Request Return')}
                </Button>
                <button onClick={() => setSelectedLoanIds([])} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold underline">
                  {t('إلغاء التحديد', 'Deselect all')}
                </button>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-950/50 custom-scrollbar">
             <div className="grid gap-4">
                {selectedStudentForManage?.loans.map(loan => {
                  const stockItem = inventory.find(i => getNameAr(i) === loan.componentName || i.name === loan.componentName);
                  const itemImg = stockItem?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png';
                  const isReturned = loan.status === 'مُرجع' || loan.status === 'Returned' || loan.status === 'صيانة';
                  const isOverdue = loan.status === 'متأخر' || loan.status === 'Overdue' ||
                    (!isReturned && loan.expectedReturnDate && (() => {
                      try {
                        const raw = loan.expectedReturnDate.trim();
                        const normalized = raw.replace(/\//g, '-');
                        const parts = normalized.split('-');
                        let d: Date;
                        if (parts.length === 3 && parts[0].length <= 2 && parseInt(parts[0]) <= 31 && parseInt(parts[2]) > 31) {
                          d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
                        } else {
                          d = new Date(`${parts[0]}-${(parts[1]||'01').padStart(2,'0')}-${(parts[2]||'01').padStart(2,'0')}`);
                        }
                        const today = new Date(); today.setHours(0,0,0,0);
                        return d < today && !isNaN(d.getTime());
                      } catch { return false; }
                    })());

                  const isSelected = selectedLoanIds.includes(loan.id);
                  return (
                    <div key={loan.id}
                      className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-center gap-4 transition-all hover:shadow-md cursor-pointer ${
                        isSelected ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700 bg-blue-50/20 dark:bg-blue-900/10' :
                        isReturned ? 'opacity-60 border-slate-200 dark:border-slate-800' :
                        isOverdue ? 'border-red-300 dark:border-red-800 bg-red-50/10 dark:bg-red-900/10' :
                        'border-blue-200 dark:border-blue-800'
                      }`}
                      onClick={() => {
                        if (isReturned) return;
                        setSelectedLoanIds(prev =>
                          prev.includes(loan.id) ? prev.filter(id => id !== loan.id) : [...prev, loan.id]
                        );
                      }}
                    >
                      {/* Checkbox */}
                      {!isReturned && (
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                      )}
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-1.5 shrink-0 flex items-center justify-center">
                        <img src={itemImg} alt="" className="max-w-full max-h-full object-contain" />
                      </div>

                      <div className="flex-1 min-w-0 text-center sm:text-start">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-lg truncate mb-1">
                          {loan.componentName}
                          <span className="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md ml-2 font-black border border-blue-100 dark:border-blue-800">x{loan.quantity}</span>
                        </h4>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{t('الاستلام:', 'Borrowed:')} {loan.borrowDate}</span>
                          <span className={`px-2 py-1 rounded flex items-center gap-1 ${isOverdue ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : !isReturned ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'bg-slate-100 dark:bg-slate-800'}`}>
                            {isOverdue && <span className="text-red-500">⚠️</span>}
                            {t('الإرجاع:', 'Return:')} {loan.expectedReturnDate}
                            {isOverdue && <span className="font-black text-red-600 dark:text-red-400">{t(' — متأخر!', ' — Overdue!')}</span>}
                          </span>

                          {/* 🌟 عرض المسارات الجديدة في سجل الطالب */}
                          {(stockItem?.location_ids?.length || stockItem?.location) && (
                            <LocationBadge
                              location={
                                stockItem.location_ids?.length
                                  ? stockItem.location_ids.map(id => getFullLocationPath(id)).filter(Boolean).join(' | ')
                                  : stockItem.location
                              }
                              small
                            />
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                        {!isReturned ? (
                          <Button onClick={() => openReturnModal(loan)} className="flex-1 sm:flex-none gap-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white border border-emerald-200 dark:border-emerald-800 font-bold h-10 shadow-sm transition-all">
                            <CheckCircle2 className="w-4 h-4" /> {t('استلام / فحص', 'Receive')}
                          </Button>
                        ) : (
                          <span className="flex-1 sm:flex-none text-center py-2 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700 text-sm h-10 flex items-center justify-center">{loan.status}</span>
                        )}
                        {isSuperAdmin && (
                          <Button variant="ghost" onClick={() => handleDeleteSingleItem(loan.id)} className="h-10 w-10 p-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 border border-red-100 dark:border-red-900/50 bg-white dark:bg-slate-800 shadow-sm" title={t('حذف السجل نهائياً', 'Delete Permanently')}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
             </div>
          </div>

          {selectedStudentForManage && selectedStudentForManage.loans.length > 0 && isSuperAdmin && (
            <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0 sm:justify-start">
              <Button variant="outline" onClick={() => handleDeleteAllStudentLoans(selectedStudentForManage)} className="gap-2 font-bold shadow-sm w-full sm:w-auto text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700">
                <Trash2 className="w-4 h-4" /> {t('حذف جميع سجلات الطالب', 'Delete All Records')}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ✅ نافذة إرجاع متعدد */}
      <Dialog open={bulkReturnOpen} onOpenChange={setBulkReturnOpen}>
        <DialogContent className="max-w-md font-sans bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-800 dark:text-white mb-1">
              {t('فحص القطع المسترجعة', 'Inspect Returned Items')}
            </DialogTitle>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {selectedLoanIds.length} {t('قطعة محددة للإرجاع', 'items selected for return')}
            </p>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Button onClick={() => handleBulkReturn('good')} className="h-16 flex justify-start items-center gap-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-bold text-lg w-full transition-all">
              <div className="w-10 h-10 rounded-full bg-white dark:bg-emerald-900/50 flex items-center justify-center shadow-sm"><ThumbsUp className="w-5 h-5"/></div>
              <div className="text-start">
                <p>{t('سليمة وتعمل بكفاءة', 'Good & Working')}</p>
                <p className="text-xs font-normal opacity-80">{t('إعادة الكميات للمخزون وإرسال إيميل تأكيد', 'Return to stock & send confirmation email')}</p>
              </div>
            </Button>
            <Button onClick={() => handleBulkReturn('damaged')} className="h-16 flex justify-start items-center gap-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-400 font-bold text-lg w-full transition-all">
              <div className="w-10 h-10 rounded-full bg-white dark:bg-orange-900/50 flex items-center justify-center shadow-sm"><Wrench className="w-5 h-5"/></div>
              <div className="text-start">
                <p>{t('تالفة أو تحتاج صيانة', 'Damaged / Needs Repair')}</p>
                <p className="text-xs font-normal opacity-80">{t('تحويل للصيانة وإرسال إيميل إشعار', 'Send to maintenance & notify student')}</p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={returnConditionOpen} onOpenChange={setReturnConditionOpen}>
        <DialogContent className="max-w-md font-sans bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-800 dark:text-white mb-2">{t('فحص القطعة المسترجعة', 'Inspect Returned Item')}</DialogTitle>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('كيف هي حالة القطعة بعد الاستخدام؟', 'What is the condition of the item after use?')}</p>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
             <Button onClick={() => handleReturnAction('good')} className="h-16 flex justify-start items-center gap-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-bold text-lg w-full transition-all">
                <div className="w-10 h-10 rounded-full bg-white dark:bg-emerald-900/50 flex items-center justify-center shadow-sm"><ThumbsUp className="w-5 h-5"/></div>
                <div className="text-start">
                  <p>{t('سليمة وتعمل بكفاءة', 'Good & Working')}</p>
                  <p className="text-xs font-normal opacity-80">{t('إعادة الكمية للمخزون فوراً وإخلاء طرف الطالب', 'Return to inventory and clear student')}</p>
                </div>
             </Button>

             <Button onClick={() => handleReturnAction('damaged')} className="h-16 flex justify-start items-center gap-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-400 font-bold text-lg w-full transition-all">
                <div className="w-10 h-10 rounded-full bg-white dark:bg-orange-900/50 flex items-center justify-center shadow-sm"><Wrench className="w-5 h-5"/></div>
                <div className="text-start">
                  <p>{t('تالفة أو تحتاج صيانة', 'Damaged / Needs Repair')}</p>
                  <p className="text-xs font-normal opacity-80">{t('إخلاء طرف الطالب وتحويل القطعة لقسم الصيانة', 'Clear student and send item to maintenance')}</p>
                </div>
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ نافذة صرف عهدة جديدة (محدثة) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
            <DialogTitle className="text-xl font-black text-blue-600 dark:text-blue-400 flex items-center gap-2"><Plus className="w-6 h-6" /> {t('تسليم عهدة يدوياً', 'Issue Manual Loan')}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30 dark:bg-slate-950/30">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 relative">
              <Label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Users className="w-4 h-4 text-blue-500"/> {t('ابحث عن المستفيد (بالاسم أو الرقم)', 'Search Beneficiary')}</Label>
              <div className="relative">
                <Search className={`absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400`} />
                <Input value={studentSearch} onChange={e => {setStudentSearch(e.target.value); setFoundStudent(null);}} placeholder={t('اكتب اسم المستفيد أو رقمه...', 'Type name or ID...')} className={`${lang === 'ar' ? 'pr-12' : 'pl-12'} bg-slate-50 dark:bg-slate-800 h-12 text-base rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-blue-500 dark:text-white`} />
              </div>

              {studentSearch && !foundStudent && (
                <div className="absolute z-10 w-[calc(100%-2.5rem)] max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl mt-1 custom-scrollbar">
                  {students.filter(s => s.name.includes(studentSearch) || s.universityId.includes(studentSearch)).map(s => (
                    <button key={s.universityId} onClick={() => {setFoundStudent(s); setStudentSearch('');}} className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0 flex justify-between items-center transition-colors`}>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{s.name} <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md mx-2 border border-blue-100 dark:border-blue-900">{s.role}</span></span>
                      <span className="font-mono text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded">{s.universityId}</span>
                    </button>
                  ))}
                </div>
              )}

              {foundStudent && (
                <div className="rounded-xl p-3 text-sm font-bold bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-2"><div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center text-emerald-600"><CheckCircle2 className="w-5 h-5"/></div> {foundStudent.name} <span className="font-mono text-emerald-600 dark:text-emerald-500 opacity-70 ml-2">({foundStudent.universityId})</span></div>
                  <Button variant="ghost" size="sm" onClick={() => setFoundStudent(null)} className="h-8 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-bold px-3">{t('تغيير', 'Change')}</Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col h-[500px]">
                <div className="flex flex-col gap-3 mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2"><Layers className="w-4 h-4 text-blue-500"/> {t('1. تصفح واختر القطع', '1. Browse & Select Items')}</h3>
                  <div className="flex flex-col gap-2">
                    <div className="relative flex-1">
                      <Search className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                      <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} className={`${lang === 'ar' ? 'pr-9' : 'pl-9'} h-10 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-white`} placeholder={t("بحث باسم القطعة...", "Search by item name...")} />
                    </div>
                    {/* 📦 شريط فلترة الموقع بالسكانر */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <TextCursorInput className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400`} />
                        <Input
                          placeholder={t('امسح باركود البوكس أو اكتبه...', 'Scan or type box barcode...')}
                          className={`${lang === 'ar' ? 'pr-9' : 'pl-9'} h-10 text-sm bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50 text-purple-700 dark:text-purple-300 placeholder:text-purple-300 dark:placeholder:text-purple-700 font-bold`}
                          onKeyDown={e => { if (e.key === 'Enter') { processBarcodeLoan(e.currentTarget.value); e.currentTarget.value = ''; } }}
                        />
                      </div>
                      <Button variant="outline" onClick={() => setIsScannerOpenInLoan(true)} className="h-10 px-3 border-purple-200 dark:border-purple-900/50 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 shrink-0">
                        <ScanLine className="w-4 h-4"/>
                      </Button>
                      <Button variant={selectedLocFilter ? "default" : "outline"} onClick={() => setIsLocPickerOpen(true)} className="h-10 text-xs font-bold gap-1.5 whitespace-nowrap shrink-0">
                        <MapPin className="w-3.5 h-3.5"/> {selectedLocFilter ? t('تغيير', 'Change') : t('اختر', 'Pick')}
                      </Button>
                      {selectedLocFilter && (
                        <Button variant="ghost" onClick={() => setSelectedLocFilter(null)} className="h-10 px-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"><X className="w-4 h-4"/></Button>
                      )}
                    </div>
                    {/* 🏷️ شارة الموقع المحدد */}
                    {selectedLocFilter && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                        <Package className="w-4 h-4 text-purple-500 flex-shrink-0"/>
                        <p className="text-xs font-bold text-purple-700 dark:text-purple-300 truncate">{getFullLocationPath(selectedLocFilter)}</p>
                      </div>
                    )}
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
                      const isSelected = selectedItems.some(i => getNameAr(i.comp) === getNameAr(comp));
                      return (
                        <button key={getNameAr(comp)} onClick={() => toggleItemInCart(comp)} className={`flex items-center gap-3 p-3 rounded-xl border ${lang === 'ar' ? 'text-right' : 'text-left'} transition-all ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 shadow-sm ring-1 ring-blue-400' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-600'}`}>
                          <div className="w-14 h-14 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-1 shrink-0 flex items-center justify-center">
                            <img src={comp.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png'} alt="" className="max-h-full max-w-full object-contain" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${isSelected ? 'text-blue-800 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`} title={displayCompName(comp)}>{displayCompName(comp)}</p>
                            <div className="flex flex-col gap-1.5 mt-1.5">
                              <span className="text-[10px] w-fit font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800">{t('متاح:', 'Avail:')} {comp.quantity}</span>
                              <LocationBadge
                                location={
                                  comp.location_ids?.length
                                    ? comp.location_ids.map(id => getFullLocationPath(id)).filter(Boolean).join(' | ')
                                    : comp.location
                                }
                                small
                              />
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-lg flex flex-col h-[500px] text-slate-800 dark:text-white relative overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none"></div>

                <h3 className="text-base font-black flex items-center gap-2 mb-4 text-slate-800 dark:text-white relative z-10"><ShoppingCart className="w-5 h-5 text-blue-500 dark:text-blue-400"/> {t('2. سلة العهدة وتأكيدها', '2. Cart & Confirmation')}</h3>

                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3 relative z-10">
                  {selectedItems.length === 0 ? (
                    <div className="text-center text-slate-400 dark:text-slate-500 font-bold mt-24 text-sm flex flex-col items-center"><Package className="w-16 h-16 mb-3 opacity-20"/> {t('لم يتم اختيار أي قطعة حتى الآن. انقر على القطع لإضافتها.', 'No items selected yet. Click items to add them.')}</div>
                  ) : (
                    selectedItems.map(item => (
                      <div key={getNameAr(item.comp)} className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
                        <div className="w-10 h-10 bg-slate-200/60 dark:bg-white/10 rounded-lg p-1 shrink-0"><img src={item.comp.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png'} className="w-full h-full object-contain" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }} /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate text-slate-700 dark:text-slate-200">{displayCompName(item.comp)}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-inner shrink-0" dir="ltr">
                          <button onClick={() => updateItemQty(getNameAr(item.comp), -1)} className="w-7 h-7 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"><Minus className="w-4 h-4"/></button>
                          <span className="w-6 text-center text-sm font-black text-blue-600 dark:text-blue-400">{item.qty}</span>
                          <button onClick={() => updateItemQty(getNameAr(item.comp), 1)} disabled={item.qty >= item.comp.quantity} className="w-7 h-7 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50"><Plus className="w-4 h-4"/></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 relative z-10">
                  <Label className="font-bold text-slate-600 dark:text-slate-300 mb-2 block text-xs uppercase tracking-wider">{t('تاريخ الإرجاع المتوقع', 'Expected Return Date')}</Label>
                  <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className={`bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 h-12 font-bold ${lang === 'ar' ? 'text-right' : 'text-left'}`} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0 gap-3">
            <Button variant="outline" onClick={resetDialog} className="w-full sm:w-auto font-bold border-slate-300 dark:border-slate-700 dark:text-slate-300 h-12">{t('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleAddLoan} disabled={!foundStudent || selectedItems.length === 0 || !returnDate} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md h-12 px-8 transition-transform active:scale-95">
              {t('اعتماد وتسليم العهدة', 'Confirm & Issue Loan')} ({selectedItems.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 📷 كاميرا مسح الباركود للعهود */}
      <Dialog open={isScannerOpenInLoan} onOpenChange={setIsScannerOpenInLoan}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-black border-none" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader className="p-4 bg-slate-900 border-b border-slate-800">
            <DialogTitle className="text-xl font-black flex items-center gap-2 text-white">
              <ScanLine className="w-6 h-6 text-purple-400" /> {t('امسح باركود الموقع', 'Scan Location Barcode')}
            </DialogTitle>
          </DialogHeader>
          <div className="relative w-full aspect-square bg-black">
            {isScannerOpenInLoan && (
              <Scanner
                onScan={codes => { if (codes && codes.length > 0) processBarcodeLoan(codes[0].rawValue); }}
                onError={() => {}}
                constraints={{ facingMode: 'environment' }}
                components={{ onOff: true, torch: true, zoom: true, finder: false }}
              />
            )}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-4 border-purple-500 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
            </div>
          </div>
          <div className="p-4 bg-slate-900 text-center">
            <p className="text-xs font-bold text-slate-400 mb-4">{t('وجه الكاميرا نحو باركود البوكس', 'Point camera at box barcode')}</p>
            <Button variant="outline" onClick={() => setIsScannerOpenInLoan(false)} className="w-full font-bold bg-white dark:bg-slate-700 text-black dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 border-none">{t('إغلاق', 'Close')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🌟 نافذة منتقي الشجرة للفلترة في العهد 🌟 */}
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

export default AdminLoans;