import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, ShieldAlert, Check, RefreshCw } from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { User, UserRole } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { Table, Column } from '../../components/ui/Table.tsx';
import { RoleBadge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

export const AdminEmployeesPage: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('WORKER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.employees.getAll();
      if (res.success) setEmployees(res.data);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل بيانات الموظفين');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadData();
    }
  }, [user?.role]);

  // Strict RBAC enforcement: Only ADMIN can manage employees
  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-8 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
        <h3 className="font-bold text-red-950 text-base">غير مصرح بالوصول (حساب المدير العام فقط)</h3>
        <p className="text-xs text-red-700 max-w-md mx-auto leading-relaxed">
          إدارة موظفي المصنع وصلاحيات النظام محصورة بمدير النظام (ADMIN). لا يملك مشرف الإنتاج أو عمال التشغيل صلاحية تعديل حسابات الموظفين.
        </p>
      </div>
    );
  }

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !role) return;

    setIsSubmitting(true);
    try {
      const res = await api.employees.create({
        name,
        email,
        password,
        phone,
        role,
      });

      if (res.success) {
        setIsModalOpen(false);
        setName('');
        setEmail('');
        setPassword('');
        setPhone('');
        setRole('WORKER');
        setSuccessMsg('تم إضافة الموظف الجديد بنجاح');
        await loadData();
      }
    } catch (err: any) {
      alert(err.message || 'فشل في إنشاء حساب الموظف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (emp: User) => {
    const newStatus = emp.is_active === 1 ? false : true;
    try {
      const res = await api.employees.update(emp.id, { is_active: newStatus });
      if (res.success) {
        await loadData();
      }
    } catch (err: any) {
      alert(err.message || 'فشل تحديث حالة الموظف');
    }
  };

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'الموظف',
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
            {u.name.charAt(0)}
          </div>
          <div>
            <span className="font-bold text-slate-900 block text-xs">{u.name}</span>
            <span className="text-[11px] text-slate-500">{u.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'الرتبة والدور',
      render: (u) => <RoleBadge role={u.role} />,
    },
    {
      key: 'phone',
      header: 'رقم الهاتف',
      render: (u) => <span className="font-mono text-xs text-slate-600">{u.phone || '-'}</span>,
    },
    {
      key: 'is_active',
      header: 'الحالة',
      render: (u) => (
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
            u.is_active === 1
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active === 1 ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {u.is_active === 1 ? 'نشط' : 'معطل'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      align: 'end',
      render: (u) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleToggleActive(u)}
          disabled={u.id === user?.id}
          className="text-xs"
        >
          {u.is_active === 1 ? 'تعطيل الحساب' : 'تنشيط'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">إدارة فريق العمل والموظفين</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            التحكم في حسابات مشرفي الإنتاج وعمال الخياطة وتوزيع الصلاحيات (خاص بالمدير العام فقط).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            icon={<Plus className="h-4 w-4" />}
          >
            إضافة موظف جديد
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} icon={<RefreshCw className="h-3.5 w-3.5" />}>
            تحديث
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 text-xs hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingState message="جاري جلب سجل الموظفين..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <Table columns={columns} data={employees} keyExtractor={(u) => u.id} emptyMessage="لا يوجد موظفون" />
      )}

      {/* Add Employee Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="تسجيل موظف جديد في نظام المصنع"
        maxWidth="md"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
          <Input
            label="اسم الموظف *"
            placeholder="مثال: حسام عادل"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="البريد الإلكتروني *"
            type="email"
            placeholder="worker2@factory.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="كلمة المرور المؤقتة *"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Input
            label="رقم الهاتف"
            placeholder="010XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <Select
            label="الرتبة والصلاحية *"
            options={[
              { value: 'WORKER', label: 'فني تشغيل وخياطة (Worker - مهام محددة فقط)' },
              { value: 'MANAGER', label: 'مشرف إنتاج (Manager - إدارة الكتالوج والطلبات)' },
              { value: 'ADMIN', label: 'مدير عام (Admin - كامل صلاحيات النظام)' },
            ]}
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            required
          />

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              إنشاء الحساب
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
