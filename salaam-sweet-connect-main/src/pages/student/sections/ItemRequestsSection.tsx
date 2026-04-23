import { useState, useEffect } from 'react';
import { useLanguage } from '@/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { apiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus, Package, Clock, CheckCircle2, XCircle, ShoppingBag, AlertTriangle,
  Link2, ImageIcon, Send, Loader2, Sparkles, ExternalLink, MessageSquare
} from 'lucide-react';

interface ItemRequest {
  id: number;
  item_name: string;
  item_name_en: string;
  category: string;
  quantity: number;
  description: string;
  urgency: string;
  reference_url: string;
  image_url: string;
  status: string;
  admin_comment: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { ar: 'إلكترونيات', en: 'Electronics' },
  { ar: 'ميكانيكا', en: 'Mechanical' },
  { ar: 'أدوات يدوية', en: 'Hand Tools' },
  { ar: 'حساسات', en: 'Sensors' },
  { ar: 'أسلاك وتوصيلات', en: 'Wires & Connectors' },
  { ar: 'طباعة ثلاثية الأبعاد', en: '3D Printing' },
  { ar: 'معدات سلامة', en: 'Safety Equipment' },
  { ar: 'برمجيات', en: 'Software' },
  { ar: 'أخرى', en: 'Other' },
];

interface ItemRequestsSectionProps {
  userId: string;
  userName: string;
}

export default function ItemRequestsSection({ userId, userName }: ItemRequestsSectionProps) {
  const { lang, t } = useLanguage();
  const { toast } = useToast();

  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('all');

  const [form, setForm] = useState({
    itemName: '',
    itemNameEn: '',
    category: 'إلكترونيات',
    quantity: 1,
    description: '',
    urgency: 'normal',
    referenceUrl: '',
    imageUrl: '',
  });

  const fetchRequests = async () => {
    if (!userId) return;
    try {
      const res = await fetch(apiUrl(`/api/item-requests/my/${userId}`));
      if (res.ok) {
        const data = await res.json();
        setRequests(data.data || []);
      }
    } catch {
      console.error('Failed to fetch item requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, [userId]);

  const handleSubmit = async () => {
    if (!form.itemName.trim()) {
      toast({ title: t('اسم القطعة مطلوب', 'Item name is required'), variant: 'destructive' });
      return;
    }
    if (!form.description.trim()) {
      toast({ title: t('الوصف مطلوب', 'Description required'), variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/item-requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: userId,
          studentName: userName,
          itemName: form.itemName.trim(),
          itemNameEn: form.itemNameEn.trim(),
          category: form.category,
          quantity: form.quantity,
          description: form.description.trim(),
          urgency: form.urgency,
          referenceUrl: form.referenceUrl.trim(),
          imageUrl: form.imageUrl.trim(),
        }),
      });
      if (res.ok) {
        toast({ title: t('تم إرسال طلبك بنجاح ✅', 'Request submitted successfully ✅') });
        setFormOpen(false);
        setForm({ itemName: '', itemNameEn: '', category: 'إلكترونيات', quantity: 1, description: '', urgency: 'normal', referenceUrl: '', imageUrl: '' });
        fetchRequests();
      } else {
        const d = await res.json();
        toast({ title: d.message || t('خطأ', 'Error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    pending:   { label: t('قيد المراجعة', 'Pending'),    color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',   icon: Clock },
    approved:  { label: t('تمت الموافقة', 'Approved'),   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', icon: CheckCircle2 },
    rejected:  { label: t('مرفوض', 'Rejected'),          color: 'text-red-600 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',           icon: XCircle },
    purchased: { label: t('تم الشراء', 'Purchased'),     color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',       icon: ShoppingBag },
  };

  const urgencyConfig: Record<string, { label: string; color: string }> = {
    normal: { label: t('عادي', 'Normal'),     color: 'text-slate-500' },
    high:   { label: t('مهم', 'High'),        color: 'text-orange-500' },
    urgent: { label: t('طارئ', 'Urgent'),     color: 'text-red-500' },
  };

  const filteredRequests = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Hero CTA */}
      <div className="card-3xl bg-gradient-to-r from-purple-700 via-indigo-600 to-blue-700 dark:from-slate-800 dark:via-purple-900 dark:to-indigo-950 p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black">{t('تحتاج قطعة مو موجودة؟', 'Need an item not in stock?')}</h2>
              <p className="text-purple-200 text-sm font-medium">{t('اطلبها وحنا نوفرها لك!', 'Request it and we will provide it!')}</p>
            </div>
          </div>
          <Button onClick={() => setFormOpen(true)} className="mt-4 bg-white text-purple-700 hover:bg-purple-50 font-black px-6 py-5 text-md shadow-lg gap-2">
            <Plus className="w-5 h-5" /> {t('طلب قطعة جديدة', 'Request New Item')}
          </Button>
        </div>
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-white rounded-full blur-3xl blob-pulse" />
          <div className="absolute bottom-[-40px] left-[-40px] w-72 h-72 bg-indigo-400 rounded-full blur-3xl blob-pulse" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all',       label: t('الكل', 'All'),           count: requests.length },
          { key: 'pending',   label: t('قيد المراجعة', 'Pending'), count: requests.filter(r => r.status === 'pending').length },
          { key: 'approved',  label: t('موافق عليها', 'Approved'), count: requests.filter(r => r.status === 'approved').length },
          { key: 'purchased', label: t('تم شراؤها', 'Purchased'),  count: requests.filter(r => r.status === 'purchased').length },
          { key: 'rejected',  label: t('مرفوضة', 'Rejected'),      count: requests.filter(r => r.status === 'rejected').length },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              filter === f.key
                ? 'bg-blue-600 text-white shadow-cta'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {f.label} {f.count > 0 && <span className={`${filter === f.key ? 'text-blue-200' : 'text-slate-400'} font-mono text-xs`}>({f.count})</span>}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /></div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-16 card-3xl border-dashed">
          <Package className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-lg font-black text-slate-500 dark:text-slate-400">{t('لا توجد طلبات بعد', 'No requests yet')}</p>
          <p className="text-sm text-slate-400 mt-1">{t('اطلب قطعة جديدة وستظهر هنا', 'Request a new item and it will appear here')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map(req => {
            const sc = statusConfig[req.status] || statusConfig.pending;
            const uc = urgencyConfig[req.urgency] || urgencyConfig.normal;
            const StatusIcon = sc.icon;
            return (
              <div key={req.id} className="card-3xl overflow-hidden">
                <div className={`px-4 py-2.5 ${sc.bg} border-b flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`w-4 h-4 ${sc.color}`} />
                    <span className={`text-xs font-black ${sc.color}`}>{sc.label}</span>
                  </div>
                  <span className={`text-[10px] font-bold ${uc.color}`}>
                    {req.urgency === 'urgent' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                    {uc.label}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-white text-base leading-tight">{req.item_name}</h3>
                    {req.item_name_en && <p className="text-xs text-slate-400 font-mono mt-0.5">{req.item_name_en}</p>}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg font-bold">{req.category}</span>
                    <span className="font-mono">{t('الكمية:', 'Qty:')} {req.quantity}</span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">{req.description}</p>

                  {req.reference_url && (
                    <a href={req.reference_url} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold">
                      <ExternalLink className="w-3 h-3" /> {t('رابط مرجعي', 'Reference Link')}
                    </a>
                  )}

                  {req.admin_comment && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <MessageSquare className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">{t('رد المشرف', 'Admin Reply')}</span>
                      </div>
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{req.admin_comment}</p>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400 font-mono">
                      {new Date(req.created_at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-purple-700 dark:text-purple-400 flex items-center gap-2">
              <Sparkles className="w-6 h-6" /> {t('طلب قطعة جديدة', 'Request New Item')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-bold mb-1.5 block">
                  {t('اسم القطعة *', 'Item Name *')}
                </Label>
                <Input
                  value={form.itemName}
                  onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))}
                  placeholder={t('مثال: حساس ليدار', 'e.g. LiDAR Sensor')}
                  className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-white"
                />
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-bold mb-1.5 block">
                  {t('الاسم بالإنجليزية (اختياري)', 'English Name (optional)')}
                </Label>
                <Input
                  value={form.itemNameEn}
                  onChange={e => setForm(f => ({ ...f, itemNameEn: e.target.value }))}
                  placeholder="e.g. LiDAR Sensor TF-Luna"
                  className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-white"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-bold mb-1.5 block">
                  {t('الفئة', 'Category')}
                </Label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.ar} value={c.ar}>{t(c.ar, c.en)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-bold mb-1.5 block">
                  {t('الكمية المطلوبة', 'Quantity Needed')}
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-700 dark:text-slate-300 font-bold mb-1.5 block">
                {t('الوصف — لِيش تحتاجها؟ *', 'Description — Why do you need it? *')}
              </Label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('اشرح استخدامك للقطعة ولِيش تحتاجها', 'Explain your use case and why you need this item')}
                rows={3}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <Label className="text-slate-700 dark:text-slate-300 font-bold mb-2 block">
                {t('الأولوية', 'Priority')}
              </Label>
              <div className="flex gap-2">
                {[
                  { key: 'normal', label: t('عادي', 'Normal'),  icon: '🟢' },
                  { key: 'high',   label: t('مهم', 'High'),     icon: '🟡' },
                  { key: 'urgent', label: t('طارئ', 'Urgent'),  icon: '🔴' },
                ].map(u => (
                  <button
                    key={u.key}
                    onClick={() => setForm(f => ({ ...f, urgency: u.key }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                      form.urgency === u.key
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {u.icon} {u.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-blue-500" />
                {t('رابط مرجعي (اختياري)', 'Reference URL (optional)')}
              </Label>
              <Input
                value={form.referenceUrl}
                onChange={e => setForm(f => ({ ...f, referenceUrl: e.target.value }))}
                placeholder={t('رابط من أمازون، علي إكسبرس، ...', 'Amazon, AliExpress link...')}
                className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-white"
                dir="ltr"
              />
            </div>

            <div>
              <Label className="text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-purple-500" />
                {t('رابط صورة (اختياري)', 'Image URL (optional)')}
              </Label>
              <Input
                value={form.imageUrl}
                onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://example.com/image.jpg"
                className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-white"
                dir="ltr"
              />
              {form.imageUrl && (
                <div className="mt-2 w-20 h-20 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800">
                  <img src={form.imageUrl} alt="Preview" className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-3 sm:gap-2 mt-4">
            <Button variant="outline" onClick={() => setFormOpen(false)} className="w-full sm:w-auto dark:border-slate-600 dark:text-slate-300">
              {t('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.itemName.trim()} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2 px-6">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? t('جاري الإرسال...', 'Submitting...') : t('إرسال الطلب', 'Submit Request')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
