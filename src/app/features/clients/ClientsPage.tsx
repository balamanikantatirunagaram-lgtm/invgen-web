import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  useClients,
  useCreateClient,
  useDeleteClient,
  useOwnerId,
  useUpdateClient,
} from '../../hooks/queries';
import { userMessage } from '../../lib/errors';
import { INDIAN_STATES, normalizeStateCode } from '../../lib/states';
import {
  requiredField,
  validateEmail,
  validateGstin,
  validateMobile,
} from '../../lib/validators';
import { gstDisplayName, verifyGst } from '../../api/gstVerify';
import type { Client } from '../../api/types';
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

interface ClientForm {
  businessName: string;
  gstin: string;
  /** Required when GSTIN is empty (place-of-supply fallback). */
  supplyState: string;
  billingAddress: string;
  shippingAddress: string;
  mobile: string;
  email: string;
}

const EMPTY_FORM: ClientForm = {
  businessName: '',
  gstin: '',
  supplyState: '',
  billingAddress: '',
  shippingAddress: '',
  mobile: '',
  email: '',
};

function toForm(c: Client): ClientForm {
  return {
    businessName: c.businessName,
    gstin: c.gstin,
    supplyState: c.supplyState,
    billingAddress: c.billingAddress,
    shippingAddress: c.shippingAddress,
    mobile: c.mobile,
    email: c.email,
  };
}

export default function ClientsPage() {
  const ownerId = useOwnerId();
  const clientsQuery = useClients();
  const createMut = useCreateClient();
  const updateMut = useUpdateClient();
  const deleteMut = useDeleteClient();

  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<Client | null>(null);

  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof ClientForm, string>>>({});
  const [verifying, setVerifying] = useState(false);
  const [verifyNote, setVerifyNote] = useState<string | null>(null);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setVerifyNote(null);
    setModalOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm(toForm(c));
    setErrors({});
    setVerifyNote(null);
    setModalOpen(true);
  };

  const set = (k: keyof ClientForm, v: string) => {
    setForm((f) => ({ ...f, [k]: k === 'gstin' ? v.toUpperCase() : v }));
  };

  const doVerifyGst = async () => {
    const g = form.gstin.trim().toUpperCase();
    if (g.length !== 15) {
      setVerifyNote('Enter 15-character GSTIN first.');
      return;
    }
    setVerifying(true);
    setVerifyNote(null);
    try {
      const r = await verifyGst(g); // prefill only — Active not required
      setForm((f) => ({
        ...f,
        businessName: f.businessName.trim() === '' && gstDisplayName(r) !== '' ? gstDisplayName(r) : f.businessName,
        billingAddress: f.billingAddress.trim() === '' && r.address !== '' ? r.address : f.billingAddress,
      }));
      setVerifyNote(`${gstDisplayName(r)} — ${r.status}`);
    } catch (e) {
      setVerifyNote(userMessage(e));
    } finally {
      setVerifying(false);
    }
  };

  const doSave = () => {
    const e: Partial<Record<keyof ClientForm, string>> = {};
    const nameErr = requiredField(form.businessName, 'Business name');
    if (nameErr) e.businessName = nameErr;
    const gstErr = validateGstin(form.gstin, false);
    if (gstErr) e.gstin = gstErr;
    if (form.gstin.trim() === '' && normalizeStateCode(form.supplyState) === '') {
      e.supplyState = 'State is required when GSTIN is empty';
    }
    const mobErr = validateMobile(form.mobile, false);
    if (mobErr) e.mobile = mobErr;
    const emailErr = validateEmail(form.email, false);
    if (emailErr) e.email = emailErr;
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const payload = {
      // tradeName has no form field (mirrors mobile) — preserved on edit.
      tradeName: editing?.tradeName ?? '',
      businessName: form.businessName.trim(),
      gstin: form.gstin.trim().toUpperCase(),
      supplyState: normalizeStateCode(form.supplyState),
      billingAddress: form.billingAddress.trim(),
      shippingAddress: form.shippingAddress.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim(),
    };
    if (editing) {
      updateMut.mutate(
        { ...editing, ...payload },
        {
          onSuccess: () => {
            toast('Client saved');
            setModalOpen(false);
          },
          onError: (err) => toast(userMessage(err)),
        },
      );
    } else {
      createMut.mutate(payload, {
        onSuccess: () => {
          toast('Client added');
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
        toast('Client deleted');
        setDeleting(null);
      },
      onError: (err) => toast(userMessage(err)),
    });
  };

  const items = useMemo(() => {
    const list = clientsQuery.data ?? [];
    const needle = q.trim().toLowerCase();
    if (needle === '') return list;
    return list.filter((c) =>
      `${c.businessName} ${c.gstin} ${c.mobile}`.toLowerCase().includes(needle),
    );
  }, [clientsQuery.data, q]);

  void ownerId;
  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Bill-to / ship-to parties"
        action={<PrimaryButton onClick={openAdd}>+ Add Client</PrimaryButton>}
      />

      <div className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name / GSTIN / mobile"
          type="search"
          className={`${inputCls} max-w-md`}
        />
      </div>

      {clientsQuery.isLoading ? (
        <LoadingState message="Loading clients…" />
      ) : clientsQuery.isError ? (
        <ErrorState
          message={userMessage(clientsQuery.error)}
          onRetry={() => clientsQuery.refetch()}
        />
      ) : (
        <DataTable
          headers={['Business', 'GSTIN', 'Mobile', 'Billing address', '']}
          rows={items.map((c) => (
            <tr key={c.id} className="hover:bg-surface-soft/50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-surface-soft border border-border-color flex items-center justify-center font-bold shrink-0">
                    {(c.businessName || '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold">{c.businessName}</span>
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-[13px]">
                {c.gstin === '' ? <span className="text-ink-tertiary">No GSTIN</span> : c.gstin}
              </td>
              <td className="px-4 py-3">{c.mobile === '' ? '–' : c.mobile}</td>
              <td className="px-4 py-3 max-w-[240px] truncate text-ink-secondary">
                {c.billingAddress === '' ? '–' : c.billingAddress}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => openEdit(c)}
                    className="p-2 rounded-lg text-ink-secondary hover:text-ink hover:bg-surface-soft"
                    title="Edit"
                    aria-label={`Edit ${c.businessName}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(c)}
                    className="p-2 rounded-lg text-ink-secondary hover:text-red-700 hover:bg-red-50"
                    title="Delete"
                    aria-label={`Delete ${c.businessName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          empty={
            <EmptyState
              title="No clients yet"
              message={
                q.trim() === ''
                  ? 'Add your first party to use in invoices.'
                  : `No clients match “${q.trim()}”.`
              }
              actionLabel="ADD CLIENT"
              onAction={openAdd}
            />
          }
        />
      )}

      {modalOpen && (
        <Modal
          title={editing ? 'Edit Client' : 'Add Client'}
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
            <Field label="Business Name" required error={errors.businessName}>
              <input
                value={form.businessName}
                onChange={(e) => set('businessName', e.target.value)}
                className={inputCls}
                placeholder="Acme Traders"
              />
            </Field>
            <Field label="GSTIN" error={errors.gstin}>
              <div className="flex gap-2">
                <input
                  value={form.gstin}
                  onChange={(e) => set('gstin', e.target.value)}
                  maxLength={15}
                  placeholder="27ABCDE1234F1Z5"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${inputCls} uppercase font-mono`}
                />
                <button
                  onClick={doVerifyGst}
                  disabled={verifying}
                  className="shrink-0 px-4 rounded-xl border border-border-strong text-sm font-semibold hover:bg-surface-soft transition-colors disabled:opacity-60"
                >
                  {verifying ? 'Checking…' : 'Verify'}
                </button>
              </div>
            </Field>
            {verifyNote && <p className="text-sm text-ink-secondary -mt-2">{verifyNote}</p>}
            <Field
              label="State"
              required={form.gstin.trim() === ''}
              error={errors.supplyState}
              hint="Place of supply — required when GSTIN is empty"
            >
              <select
                value={form.supplyState}
                onChange={(e) => set('supplyState', e.target.value)}
                className={inputCls}
              >
                <option value="">Select state…</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Billing Address" hint="Autofilled on verify">
              <textarea
                value={form.billingAddress}
                onChange={(e) => set('billingAddress', e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>
            <Field label="Shipping Address" hint="Optional — falls back to billing">
              <textarea
                value={form.shippingAddress}
                onChange={(e) => set('shippingAddress', e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Mobile" error={errors.mobile}>
                <input
                  value={form.mobile}
                  onChange={(e) => set('mobile', e.target.value)}
                  inputMode="tel"
                  placeholder="9876543210"
                  className={inputCls}
                />
              </Field>
              <Field label="Email" error={errors.email}>
                <input
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  inputMode="email"
                  placeholder="billing@acme.in"
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete client?"
          message={`${deleting.businessName} will be permanently removed. Existing invoices keep their snapshots.`}
          onConfirm={doDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteMut.isPending}
          danger
        />
      )}
    </div>
  );
}
