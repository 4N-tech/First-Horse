import React, { useState, useEffect } from 'react';
import { Users, Phone, MapPin, Eye, ShieldAlert, RefreshCw } from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { Customer } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { Table, Column } from '../../components/ui/Table.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

export const AdminCustomersPage: React.FC = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.customers.getAll();
      if (res.success) setCustomers(res.data);
    } catch (err: any) {
      setError(err.message || 'فشل في تحميل العملاء');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (user?.role === 'WORKER') {
    return (
      <div className="p-8 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
        <h3 className="font-bold text-red-950 text-base">غير مصرح بالوصول</h3>
        <p className="text-xs text-red-700 max-w-md mx-auto">
          صلاحيات فني التشغيل محددة في استعراض وتحديث الطلبات المسندة فقط.
        </p>
      </div>
    );
  }

  const handleViewCustomer = async (c: Customer) => {
    setSelectedCustomer(c);
    setIsModalOpen(true);
    try {
      const res = await api.customers.getOne(c.id);
      if (res.success) {
        setSelectedCustomer(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'اسم العميل',
      render: (c) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700">
            {c.name.charAt(0)}
          </div>
          <div>
            <span className="font-bold text-slate-900 block text-xs">{c.name}</span>
            <span className="text-[11px] text-slate-400">ID: #{c.id}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'رقم الهاتف',
      render: (c) => (
        <span className="font-mono text-xs text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          {c.phone}
        </span>
      ),
    },
    {
      key: 'orders_count',
      header: 'عدد الطلبات',
      render: (c) => (
        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
          {c.orders_count || 0} طلبات
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'تاريخ التسجيل',
      render: (c) => <span className="text-[11px] text-slate-500 font-mono">{c.created_at}</span>,
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      align: 'end',
      render: (c) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleViewCustomer(c)}
          icon={<Eye className="h-3.5 w-3.5" />}
        >
          تفاصيل العناوين
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">سجل عملاء المصنع</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            قاعدة بيانات عملاء الجملة والتجزئة وعناوين التوصيل المرتبطة بالطلبات.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadData} icon={<RefreshCw className="h-3.5 w-3.5" />}>
          تحديث
        </Button>
      </div>

      {isLoading ? (
        <LoadingState message="جاري جلب العملاء..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <Table columns={columns} data={customers} keyExtractor={(c) => c.id} emptyMessage="لا يوجد عملاء مسجلون" />
      )}

      {/* Customer details modal */}
      {selectedCustomer && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`بيانات العميل: ${selectedCustomer.name}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">الهاتف:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedCustomer.phone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">إجمالي الطلبات:</span>
                  <span className="font-bold text-indigo-600">{selectedCustomer.orders_count || 0}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-indigo-600" />
                <span>عناوين التوصيل المسجلة:</span>
              </h4>
              <div className="space-y-2">
                {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (
                  selectedCustomer.addresses.map((addr: any) => (
                    <div key={addr.id} className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
                      <div className="font-bold text-slate-800">
                        {addr.governorate} - {addr.city}
                      </div>
                      <div className="text-slate-600 text-[11px]">{addr.address}</div>
                      {addr.notes && (
                        <div className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px]">
                          ملاحظة: {addr.notes}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-center py-4">لا توجد عناوين مسجلة للعميل</p>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
