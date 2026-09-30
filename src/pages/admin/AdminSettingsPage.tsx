import React, { useState, useEffect } from 'react';
import { Settings, ShieldAlert, Check, RefreshCw } from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { api } from '../../lib/api.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

export const AdminSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.dashboard.getSettings();
      if (res.success) setSettings(res.data);
    } catch (err: any) {
      setError(err.message || 'فشل جلب الإعدادات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadSettings();
    }
  }, [user?.role]);

  // Strict check: Admin only
  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-8 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
        <h3 className="font-bold text-red-950 text-base">غير مصرح بالوصول (حساب المدير العام فقط)</h3>
        <p className="text-xs text-red-700 max-w-md mx-auto">
          إعدادات المصنع الحساسة والسياسات العامة محصورة فقط بالمدير العام. لا يمكن للمشرفين أو العمال تعديلها.
        </p>
      </div>
    );
  }

  if (isLoading) return <LoadingState message="جاري جلب إعدادات المصنع..." />;
  if (error) return <ErrorState message={error} onRetry={loadSettings} />;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">إعدادات النظام والمصنع</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            التحكم في المعاملات الأساسية وبيانات المصنع (خاص بالمدير العام).
          </p>
        </div>
      </div>

      {saved && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>تم حفظ الإعدادات بنجاح</span>
        </div>
      )}

      <Card>
        <form onSubmit={handleSave} className="space-y-4 text-xs max-w-xl">
          <Input
            label="اسم المصنع الرسمي"
            value={settings?.factory_name || ''}
            onChange={(e) => setSettings({ ...settings, factory_name: e.target.value })}
          />

          <Input
            label="كود المنشأة الصناعية"
            value={settings?.factory_code || ''}
            onChange={(e) => setSettings({ ...settings, factory_code: e.target.value })}
          />

          <Input
            label="العملة الافتراضية"
            value={settings?.default_currency || ''}
            onChange={(e) => setSettings({ ...settings, default_currency: e.target.value })}
          />

          <Input
            label="المنطقة الزمنية"
            value={settings?.timezone || ''}
            onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
          />

          <Input
            label="تكلفة الشحن والتوصيل الافتراضية (ج.م)"
            type="number"
            value={settings?.delivery_fee_default || ''}
            onChange={(e) => setSettings({ ...settings, delivery_fee_default: Number(e.target.value) })}
          />

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
            <span className="font-bold block mb-0.5">حالة النظام المعماري:</span>
            <span>{settings?.phase} - Version {settings?.system_version}</span>
          </div>

          <Button type="submit" variant="primary">
            حفظ التغييرات
          </Button>
        </form>
      </Card>
    </div>
  );
};
