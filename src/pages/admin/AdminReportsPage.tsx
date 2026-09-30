import React, { useState, useEffect } from 'react';
import { BarChart3, ShieldAlert, RefreshCw, CheckCircle2, DollarSign, Package } from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { api } from '../../lib/api.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

export const AdminReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [reportData, setReportData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.dashboard.getReports();
      if (res.success) {
        setReportData(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'فشل جلب التقارير');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
      loadReports();
    }
  }, [user?.role]);

  if (user?.role === 'WORKER') {
    return (
      <div className="p-8 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
        <h3 className="font-bold text-red-950 text-base">غير مصرح بالاطلاع على التقارير</h3>
        <p className="text-xs text-red-700 max-w-md mx-auto">
          التقارير والمؤشرات المالية وتدفقات الإنتاج متاحة فقط للإدارة والمشرفين.
        </p>
      </div>
    );
  }

  if (isLoading) return <LoadingState message="جاري إعداد تقرير المصنع..." />;
  if (error) return <ErrorState message={error} onRetry={loadReports} />;

  const statuses = [
    { label: 'قيد الانتظار', count: reportData?.pending || 0, color: 'bg-amber-500' },
    { label: 'مؤكد', count: reportData?.confirmed || 0, color: 'bg-sky-500' },
    { label: 'قيد التجهيز / التصنيع', count: reportData?.processing || 0, color: 'bg-indigo-500' },
    { label: 'جاهز للاستلام', count: reportData?.ready || 0, color: 'bg-emerald-500' },
    { label: 'تم الشحن', count: reportData?.shipped || 0, color: 'bg-blue-600' },
    { label: 'تم التسليم', count: reportData?.delivered || 0, color: 'bg-teal-600' },
    { label: 'ملغي', count: reportData?.cancelled || 0, color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">التقارير ومؤشرات الإنتاج الأساسية</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            مؤشرات أولية لحالات الطلبات وإجمالي التدفق المالي (المرحلة الأولى).
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadReports} icon={<RefreshCw className="h-3.5 w-3.5" />}>
          تحديث
        </Button>
      </div>

      {/* Revenue Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-s-4 border-s-emerald-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">إجمالي قيمة الطلبات المسجلة</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {reportData?.gross_revenue || 0} ج.م
              </h3>
              <span className="text-[10px] text-slate-400 mt-0.5 block">شامل تكاليف الشحن</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="border-s-4 border-s-indigo-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">حالة خطوط التصنيع</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {(reportData?.processing || 0) + (reportData?.ready || 0)} طلبات نشطة
              </h3>
              <span className="text-[10px] text-indigo-600 mt-0.5 block font-medium">بين التصنيع والجاهزية</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Package className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <h3 className="text-sm font-bold text-slate-900 mb-4">توزيع الطلبات حسب مراحل التشغيل</h3>
        <div className="space-y-3">
          {statuses.map((st) => (
            <div key={st.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${st.color}`} />
                <span className="font-semibold text-slate-700">{st.label}</span>
              </div>
              <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {st.count}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
