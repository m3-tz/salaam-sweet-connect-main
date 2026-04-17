import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '../../LanguageContext';
import { apiUrl } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Package, Clock, CheckCircle2, XCircle, ShoppingBag, AlertTriangle,
  Search, RefreshCw, ExternalLink, MessageSquare, Users, Trash2,
  ChevronDown, ChevronUp, Link2, Eye, Send, Sparkles, TrendingUp,
  PackagePlus, ImageIcon, BarChart3
} from 'lucide-react';

interface ItemRequest {
  id: number;
  student_id: string;
  student_name: string;
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
  admin_name: string;
  created_at: string;
  updated_at: string;
}

interface DuplicateItem {
  item_name: string;
  student_count: number;
  total_qty: number;
}

const AdminItemRequests = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();

  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');

  // Action dialog
  const [actionReq, setActionReq] = useState<ItemRequest | null>(null);
  const [actionType, setActionType] = useState<string>('');
  const [adminComment, setAdminComment] = useState('');
  const [processing, setProcessing] = useState(false);

  // Detail view
  const [detailReq, setDetailReq] = useState<ItemRequest | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (urgencyFilter) params.set('urgency', urgencyFilter);

      const res = await fetch(apiUrl(`/api/item-requests?${params.toString()}`));
      if (res.ok) {
        const data = await res.json();
        setRequests(data.data || []);
        setStats(data.stats || {});
        setDuplicates(data.duplicates || []);
      }
    } catch {
      toast({ title: t('خطأ في التحميل', 'Loading Error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, urgencyFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async () => {
    if (!actionReq || !actionType) return;
    setProcessing(true);
    try {
      const res = await fetch(apiUrl(`/api/item-requests/${actionReq.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'admin-id': user?.id || '',
          'admin-name': encodeURIComponent(user?.name || ''),
        },
        body: JSON.stringify({ status: actionType, adminComment: adminComment.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        let msg = t('تم التحديث ✅', 'Updated ✅');
        if (data.added_to_inventory) {
          msg += ' — ' + t('وتم إضافة القطعة للمخزون تلقائياً 📦', 'Item auto-added to inventory 📦');
        }
        toast({ title: msg });
        setActionReq(null);
        setAdminComment('');
        fetchData();
      } else {
        toast({ title: data.message || t('خطأ', 'Error'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('هل أنت متأكد من حذف هذا الطلب؟', 'Delete this request?'))) return;
    try {
      const res = await fetch(apiUrl(`/api/item-requests/${id}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'admin-id': user?.id || '',
          'admin-name': encodeURIComponent(user?.name || ''),
        },
      });
      if (res.ok) {
        toast({ title: t('تم الحذف ✅', 'Deleted ✅') });
        fetchData();
      }
    } catch {
      toast({ title: t('خطأ', 'Error'), variant: 'destructive' });
    }
  };

  const openAction = (req: ItemRequest, type: string) => {
    setActionReq(req);
    setActionType(type);
    setAdminComment('');
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    pending:   { label: t('معلق', 'Pending'),       color: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-900/20',    icon: Clock },
    approved:  { label: t('موافق', 'Approved'),     color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2 },
    rejected:  { label: t('مرفوض', 'Rejected'),     color: 'text-red-600 dark:text-red-400',        bg: 'bg-red-50 dark:bg-red-900/20',        icon: XCircle },
    purchased: { label: t('تم الشراء', 'Purchased'), color: 'text-blue-600 dark:text-blue-400',      bg: 'bg-blue-50 dark:bg-blue-900/20',      icon: ShoppingBag },
  };

  const urgencyLabels: Record<string, { label: string; color: string; dot: string }> = {
    normal: { label: t('عادي', 'Normal'),  color: 'text-slate-500', dot: 'bg-slate-400' },
    high:   { label: t('مهم', 'High'),     color: 'text-orange-500', dot: 'bg-orange-400' },
    urgent: { label: t('طارئ', 'Urgent'),  color: 'text-red-500',   dot: 'bg-red-500 animate-pulse' },
  };

  // Filter by search
  const filtered = requests.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.item_name.toLowerCase().includes(q)
      || r.student_name.toLowerCase().includes(q)
      || r.student_id.toLowerCase().includes(q)
      || (r.item_name_en || '').toLowerCase().includes(q);
  });

  const actionLabels: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    approved:  { label: t('موافقة — سنوفرها', 'Approve — Will provide'),   color: 'bg-emerald-600 hover:bg-emerald-700', icon: CheckCircle2 },
    rejected:  { label: t('رفض الطلب', 'Reject Request'),                  color: 'bg-red-600 hover:bg-red-700',         icon: XCircle },
    purchased: { label: t('تم الشراء + إضافة للمخزون', 'Purchased + Add to Inventory'), color: 'bg-blue-600 hover:bg-blue-700', icon: PackagePlus },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">{t('طلبات قطع جديدة', 'New Item Requests')}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t('الطلاب يطلبون قطع غير موجودة', 'Students requesting items not in stock')}</p>
          </div>
        </div>
        <Button onClick={fetchData} variant="outline" className="gap-2 dark:border-slate-700 dark:text-slate-300">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('تحديث', 'Refresh')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: t('الكل', 'Total'),      value: stats.total || 0,          color: 'text-slate-700 dark:text-slate-200', bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700' },
          { label: t('معلّقة', 'Pending'),    value: stats.pending_count || 0,  color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
          { label: t('موافق', 'Approved'),    value: stats.approved_count || 0, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' },
          { label: t('تم الشراء', 'Purchased'), value: stats.purchased_count || 0, color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
          { label: t('طارئ 🔴', 'Urgent 🔴'), value: stats.urgent_count || 0,   color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} ${s.border} border rounded-2xl p-4 text-center`}>
            <p className="text-2xl font-black">{s.value}</p>
            <p className={`text-xs font-bold ${s.color} mt-0.5`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Duplicates alert */}
      {duplicates.length > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-black text-purple-700 dark:text-purple-300 text-sm">{t('قطع مطلوبة من عدة طلاب', 'Items requested by multiple students')}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {duplicates.map((d, i) => (
              <span key={i} className="bg-purple-100 dark:bg-purple-800/40 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-full text-xs font-bold border border-purple-200 dark:border-purple-700">
                {d.item_name} — <Users className="w-3 h-3 inline" /> {d.student_count} {t('طلاب', 'students')} ({d.total_qty} {t('قطعة', 'pcs')})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('بحث بالقطعة أو الطالب...', 'Search by item or student...')}
            className={`${lang === 'ar' ? 'pr-9' : 'pl-9'} bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-white`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold"
        >
          <option value="">{t('كل الحالات', 'All Statuses')}</option>
          <option value="pending">{t('معلّقة', 'Pending')}</option>
          <option value="approved">{t('موافق', 'Approved')}</option>
          <option value="purchased">{t('تم الشراء', 'Purchased')}</option>
          <option value="rejected">{t('مرفوض', 'Rejected')}</option>
        </select>
        <select
          value={urgencyFilter}
          onChange={e => setUrgencyFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold"
        >
          <option value="">{t('كل الأولويات', 'All Priorities')}</option>
          <option value="urgent">{t('طارئ', 'Urgent')}</option>
          <option value="high">{t('مهم', 'High')}</option>
          <option value="normal">{t('عادي', 'Normal')}</option>
        </select>
      </div>

      {/* Requests Table */}
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-10 h-10 text-blue-500 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Package className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="font-black text-slate-500">{t('لا توجد طلبات', 'No requests')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const sc = statusConfig[req.status] || statusConfig.pending;
            const uc = urgencyLabels[req.urgency] || urgencyLabels.normal;
            const StatusIcon = sc.icon;
            return (
              <div key={req.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all overflow-hidden">
                <div className="flex flex-col lg:flex-row">
                  {/* Main content */}
                  <div className="flex-1 p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-black text-lg text-slate-800 dark:text-white">{req.item_name}</h3>
                          {req.item_name_en && <span className="text-xs text-slate-400 font-mono">({req.item_name_en})</span>}
                          <div className={`flex items-center gap-1 ${uc.color}`}>
                            <div className={`w-2 h-2 rounded-full ${uc.dot}`} />
                            <span className="text-[10px] font-bold">{uc.label}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg font-bold">{req.category}</span>
                          <span className="font-mono">{t('الكمية:', 'Qty:')} {req.quantity}</span>
                          <span className="font-mono">#{req.id}</span>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black ${sc.bg} ${sc.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {sc.label}
                      </div>
                    </div>

                    {/* Student info + description */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-400 mb-0.5">{t('الطالب', 'Student')}</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{req.student_name}</p>
                        <p className="text-xs text-slate-400 font-mono">{req.student_id}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-400 mb-0.5">{t('الوصف', 'Description')}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">{req.description}</p>
                      </div>
                    </div>

                    {/* Links */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {req.reference_url && (
                        <a href={req.reference_url} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-lg">
                          <ExternalLink className="w-3 h-3" /> {t('رابط مرجعي', 'Reference')}
                        </a>
                      )}
                      {req.image_url && (
                        <a href={req.image_url} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline font-bold bg-purple-50 dark:bg-purple-900/20 px-2.5 py-1 rounded-lg">
                          <ImageIcon className="w-3 h-3" /> {t('صورة', 'Image')}
                        </a>
                      )}
                      {req.admin_comment && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-lg">
                          <MessageSquare className="w-3 h-3" /> {req.admin_comment.length > 30 ? req.admin_comment.slice(0, 30) + '...' : req.admin_comment}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(req.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex lg:flex-col items-center gap-1.5 p-3 border-t lg:border-t-0 lg:border-s border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 justify-center min-w-[140px]">
                    {req.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => openAction(req, 'approved')} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {t('موافقة', 'Approve')}
                        </Button>
                        <Button size="sm" onClick={() => openAction(req, 'rejected')} variant="outline" className="w-full text-xs font-bold gap-1 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <XCircle className="w-3.5 h-3.5" /> {t('رفض', 'Reject')}
                        </Button>
                      </>
                    )}
                    {req.status === 'approved' && (
                      <Button size="sm" onClick={() => openAction(req, 'purchased')} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1">
                        <PackagePlus className="w-3.5 h-3.5" /> {t('تم الشراء', 'Purchased')}
                      </Button>
                    )}
                    {req.status === 'purchased' && (
                      <span className="text-xs text-blue-500 font-bold flex items-center gap-1">
                        <ShoppingBag className="w-4 h-4" /> {t('في المخزون', 'In Stock')}
                      </span>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(req.id)} className="w-full text-xs text-slate-400 hover:text-red-500 gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> {t('حذف', 'Delete')}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={!!actionReq} onOpenChange={() => setActionReq(null)}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-w-md" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-slate-800 dark:text-white flex items-center gap-2">
              {actionType && (() => {
                const cfg = actionLabels[actionType];
                if (!cfg) return null;
                const Icon = cfg.icon;
                return <><Icon className="w-5 h-5" /> {cfg.label}</>;
              })()}
            </DialogTitle>
          </DialogHeader>

          {actionReq && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <p className="font-black text-slate-800 dark:text-white">{actionReq.item_name}</p>
                <p className="text-xs text-slate-500 mt-1">{t('الطالب:', 'Student:')} {actionReq.student_name} ({actionReq.student_id})</p>
                <p className="text-xs text-slate-500">{t('الكمية:', 'Qty:')} {actionReq.quantity}</p>
              </div>

              {actionType === 'purchased' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1">
                    <PackagePlus className="w-4 h-4" />
                    {t('سيتم إضافة القطعة تلقائياً للمخزون بالكمية المطلوبة', 'Item will be automatically added to inventory with requested quantity')}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  {t('تعليق للطالب (اختياري)', 'Comment for student (optional)')}
                </label>
                <textarea
                  value={adminComment}
                  onChange={e => setAdminComment(e.target.value)}
                  placeholder={t(
                    actionType === 'rejected' ? 'اشرح سبب الرفض...' : 'أضف ملاحظة للطالب...',
                    actionType === 'rejected' ? 'Explain rejection reason...' : 'Add a note for the student...'
                  )}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionReq(null)} className="dark:border-slate-600 dark:text-slate-300">
              {t('إلغاء', 'Cancel')}
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              className={`text-white font-bold gap-2 ${actionLabels[actionType]?.color || 'bg-blue-600'}`}
            >
              {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {processing ? t('جاري...', 'Processing...') : t('تأكيد', 'Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminItemRequests;
