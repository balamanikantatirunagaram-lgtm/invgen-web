import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  useCreateProduct,
  useDeleteProduct,
  useProducts,
  useUpdateProduct,
} from '../../hooks/queries';
import { userMessage } from '../../lib/errors';
import { GST_SLABS, UNITS } from '../../lib/constants';
import { fmtInr } from '../../lib/format';
import {
  requiredField,
  validateGstRate,
  validateHsn,
  validateRate,
} from '../../lib/validators';
import type { Product } from '../../api/types';
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  inputCls,
  LoadingState,
  Modal,
  PageHeader,
  PrimaryButton,
} from '../../components/ui';
import { toast } from '../../components/toastBus';

interface ProductForm {
  name: string;
  hsnCode: string;
  unit: string;
  customUnit: string;
  rate: string;
  gstMode: string; // slab value or 'custom'
  customGst: string;
}

const EMPTY_FORM: ProductForm = {
  name: '',
  hsnCode: '',
  unit: 'Nos',
  customUnit: '',
  rate: '',
  gstMode: '18',
  customGst: '',
};

function toForm(p: Product): ProductForm {
  const slab = GST_SLABS.includes(p.gstRate as (typeof GST_SLABS)[number]);
  return {
    name: p.name,
    hsnCode: p.hsnCode,
    unit: (UNITS as readonly string[]).includes(p.defaultUnit) ? p.defaultUnit : 'Custom',
    customUnit: (UNITS as readonly string[]).includes(p.defaultUnit) ? '' : p.defaultUnit,
    rate: String(p.rate),
    gstMode: slab ? String(p.gstRate) : 'custom',
    customGst: slab ? '' : String(p.gstRate),
  };
}

export default function ProductsPage() {
  const productsQuery = useProducts();
  const createMut = useCreateProduct();
  const updateMut = useUpdateProduct();
  const deleteMut = useDeleteProduct();

  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'hsnCode' | 'rate' | 'gst', string>>>({});

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm(toForm(p));
    setErrors({});
    setModalOpen(true);
  };

  const set = (k: keyof ProductForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const resolvedUnit = form.unit === 'Custom' && form.customUnit.trim() !== '' ? form.customUnit.trim() : form.unit;
  const resolvedGst = form.gstMode === 'custom' ? Number(form.customGst) : Number(form.gstMode);

  const doSave = () => {
    const e: Partial<Record<'name' | 'hsnCode' | 'rate' | 'gst', string>> = {};
    const nameErr = requiredField(form.name, 'Name');
    if (nameErr) e.name = nameErr;
    const hsnErr = validateHsn(form.hsnCode, false);
    if (hsnErr) e.hsnCode = hsnErr;
    const rateErr = validateRate(form.rate);
    if (rateErr) e.rate = rateErr;
    const gstErr = validateGstRate(resolvedGst);
    if (gstErr) e.gst = gstErr;
    setErrors(e);
    if (Object.values(e).some((v) => v)) return;
    if (form.unit === 'Custom' && form.customUnit.trim() === '') {
      toast('Enter a custom unit or pick a standard one.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      hsnCode: form.hsnCode.trim(),
      defaultUnit: resolvedUnit,
      rate: Number(form.rate.trim()),
      gstRate: resolvedGst,
    };
    if (editing) {
      updateMut.mutate(
        { id: editing.id, product: payload },
        {
          onSuccess: () => {
            toast('Product saved');
            setModalOpen(false);
          },
          onError: (err) => toast(userMessage(err)),
        },
      );
    } else {
      createMut.mutate(payload, {
        onSuccess: () => {
          toast('Product added');
          setModalOpen(false);
        },
        onError: (err) => toast(userMessage(err)),
      });
    }
  };

  const doDelete = () => {
    if (!deleting) return;
    deleteMut.mutate(deleting.id, {
      onSuccess: () => {
        toast('Product deleted');
        setDeleting(null);
      },
      onError: (err) => toast(userMessage(err)),
    });
  };

  const items = useMemo(() => {
    const list = productsQuery.data ?? [];
    const needle = q.trim().toLowerCase();
    if (needle === '') return list;
    return list.filter((p) => `${p.name} ${p.hsnCode}`.toLowerCase().includes(needle));
  }, [productsQuery.data, q]);

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Catalog with HSN + GST slabs"
        action={<PrimaryButton onClick={openAdd}>+ Add Product</PrimaryButton>}
      />

      <div className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products / HSN"
          type="search"
          className={`${inputCls} max-w-md`}
        />
      </div>

      {productsQuery.isLoading ? (
        <LoadingState message="Loading products…" />
      ) : productsQuery.isError ? (
        <ErrorState
          message={userMessage(productsQuery.error)}
          onRetry={() => productsQuery.refetch()}
        />
      ) : (
        <DataTable
          headers={['Product', 'HSN', 'Unit', 'GST', 'Rate', '']}
          rows={items.map((p) => (
            <tr key={p.id} className="hover:bg-surface-soft/50">
              <td className="px-4 py-3 font-semibold">{p.name}</td>
              <td className="px-4 py-3 font-mono text-[13px]">
                {p.hsnCode === '' ? <span className="text-ink-tertiary">—</span> : p.hsnCode}
              </td>
              <td className="px-4 py-3">{p.defaultUnit}</td>
              <td className="px-4 py-3">{p.gstRate}%</td>
              <td className="px-4 py-3 font-semibold text-right">{fmtInr(p.rate)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => openEdit(p)}
                    className="p-2 rounded-lg text-ink-secondary hover:text-ink hover:bg-surface-soft"
                    title="Edit"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(p)}
                    className="p-2 rounded-lg text-ink-secondary hover:text-red-700 hover:bg-red-50"
                    title="Delete"
                    aria-label={`Delete ${p.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          empty={
            <EmptyState
              title="No products"
              message={
                q.trim() === ''
                  ? 'Add catalog items with HSN + GST.'
                  : `No products match “${q.trim()}”.`
              }
              actionLabel="ADD PRODUCT"
              onAction={openAdd}
            />
          }
        />
      )}

      {modalOpen && (
        <Modal
          title={editing ? 'Edit Product' : 'Add Product'}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button
                onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-border-strong font-semibold hover:bg-surface-soft transition-colors"
              >
                Cancel
              </button>
              <PrimaryButton onClick={doSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </PrimaryButton>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Name" required error={errors.name}>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className={inputCls}
                placeholder="Premium Widget"
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="HSN" error={errors.hsnCode}>
                <input
                  value={form.hsnCode}
                  onChange={(e) => set('hsnCode', e.target.value)}
                  inputMode="numeric"
                  placeholder="1001"
                  className={inputCls}
                />
              </Field>
              <Field label="Rate" required error={errors.rate}>
                <input
                  value={form.rate}
                  onChange={(e) => set('rate', e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Unit">
                <select
                  value={form.unit}
                  onChange={(e) => set('unit', e.target.value)}
                  className={inputCls}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="GST %" required error={errors.gst}>
                <select
                  value={form.gstMode}
                  onChange={(e) => set('gstMode', e.target.value)}
                  className={inputCls}
                >
                  {GST_SLABS.map((g) => (
                    <option key={g} value={String(g)}>
                      {g}%
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
              </Field>
            </div>
            {form.unit === 'Custom' && (
              <Field label="Custom unit" required>
                <input
                  value={form.customUnit}
                  onChange={(e) => set('customUnit', e.target.value)}
                  className={inputCls}
                  placeholder="e.g. Pair"
                />
              </Field>
            )}
            {form.gstMode === 'custom' && (
              <Field label="Custom GST %" required hint="0–28%">
                <input
                  value={form.customGst}
                  onChange={(e) => set('customGst', e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 5.5"
                  className={inputCls}
                />
              </Field>
            )}
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete product?"
          message={`${deleting.name} will be permanently removed. Existing invoices keep their snapshots.`}
          onConfirm={doDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteMut.isPending}
          danger
        />
      )}
    </div>
  );
}
