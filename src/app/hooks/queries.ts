/**
 * React Query hooks over the api/* repositories.
 *
 * Realtime strategy (mirrors mobile resilientStream):
 * - useSubscribeTables() opens ONE channel per table and invalidates the
 *   matching query keys on any postgres_change (requires migration 0003
 *   publication; harmless if absent).
 * - List queries ALSO poll every 15s as a fallback, so the UI stays alive
 *   when realtime subscribing fails.
 */
import { useEffect } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { getSupabase, isBackendConfigured } from '../supabase/client';
import { useSession } from '../stores/session';
import { fetchProfile, saveProfile } from '../api/profiles';
import { fetchCompany, saveCompany } from '../api/companies';
import {
  createClient,
  deleteClient,
  fetchClients,
  searchClients,
  updateClient,
} from '../api/clients';
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  updateProduct,
} from '../api/products';
import {
  cancelInvoice,
  createInvoiceAtomic,
  deleteInvoice,
  duplicateInvoice,
  fetchInvoiceById,
  fetchInvoices,
  setInvoiceStatus,
  updateInvoice,
  type NewInvoice,
} from '../api/invoices';
import {
  convertQuotationToInvoice,
  createQuotationAtomic,
  deleteQuotation,
  fetchQuotationById,
  fetchQuotations,
  setQuotationStatus,
  updateQuotation,
  type NewQuotation,
} from '../api/quotations';
import type {
  Client,
  CompanySettings,
  Invoice,
  InvoiceFilter,
  Product,
  Quotation,
  QuotationFilter,
  UserProfile,
} from '../api/types';

const POLL_MS = 15_000;

/** Current owner's uid (null when signed out). */
export function useOwnerId(): string | null {
  return useSession((s) => s.user?.uid ?? null);
}

function enabled(ownerId: string | null): boolean {
  return isBackendConfigured && ownerId != null;
}

// ---------------------------------------------------------------------------
// Realtime → invalidation (one channel for all owned tables)
// ---------------------------------------------------------------------------

const TABLES = [
  'profiles',
  'companies',
  'clients',
  'products',
  'invoices',
  'invoice_events',
  'quotations',
  'counters',
] as const;

/** One channel with a binding per table; any event invalidates all app queries. */
export function useSubscribeTables(): void {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();

  useEffect(() => {
    if (!enabled(ownerId)) return;
    const supabase = getSupabase();
    const channel = supabase.channel('invgen-app');
    for (const table of TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['app', ownerId] });
        },
      );
    }
    void channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ownerId, queryClient]);
}

// ---------------------------------------------------------------------------
// Profile + company
// ---------------------------------------------------------------------------

export function useProfile(): UseQueryResult<UserProfile | null> {
  const ownerId = useOwnerId();
  return useQuery({
    queryKey: ['app', ownerId, 'profile'],
    queryFn: () => fetchProfile(ownerId as string),
    enabled: enabled(ownerId),
    refetchInterval: POLL_MS,
  });
}

export function useCompany(): UseQueryResult<CompanySettings | null> {
  const ownerId = useOwnerId();
  return useQuery({
    queryKey: ['app', ownerId, 'company'],
    queryFn: () => fetchCompany(ownerId as string),
    enabled: enabled(ownerId),
    refetchInterval: POLL_MS,
  });
}

export function useSaveProfile(): UseMutationResult<void, Error, Omit<UserProfile, 'uid'>> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: (p) => saveProfile(ownerId as string, p),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['app', ownerId, 'profile'] });
    },
  });
}

export function useSaveCompany(): UseMutationResult<
  void,
  Error,
  Omit<CompanySettings, 'id' | 'updatedAt'>
> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: (c) => saveCompany(ownerId as string, c),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['app', ownerId, 'company'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export function useClients(): UseQueryResult<Client[]> {
  const ownerId = useOwnerId();
  return useQuery({
    queryKey: ['app', ownerId, 'clients'],
    queryFn: () => fetchClients(ownerId as string),
    enabled: enabled(ownerId),
    refetchInterval: POLL_MS,
  });
}

export function useClientSearch(query: string, limit = 20): UseQueryResult<Client[]> {
  const ownerId = useOwnerId();
  return useQuery({
    queryKey: ['app', ownerId, 'clients', 'search', query, limit],
    queryFn: () => searchClients(ownerId as string, query, limit),
    enabled: enabled(ownerId),
  });
}

function invalidateClients(queryClient: ReturnType<typeof useQueryClient>, ownerId: string | null) {
  void queryClient.invalidateQueries({ queryKey: ['app', ownerId, 'clients'] });
}

export function useCreateClient(): UseMutationResult<string, Error, Omit<Client, 'id' | 'ownerId'>> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: (c) => createClient({ ...c, ownerId: ownerId as string }),
    onSuccess: () => invalidateClients(queryClient, ownerId),
  });
}

export function useUpdateClient(): UseMutationResult<void, Error, Client> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: (c) => updateClient(c),
    onSuccess: () => invalidateClients(queryClient, ownerId),
  });
}

export function useDeleteClient(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: (id) => deleteClient(id),
    onSuccess: () => invalidateClients(queryClient, ownerId),
  });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export function useProducts(): UseQueryResult<Product[]> {
  const ownerId = useOwnerId();
  return useQuery({
    queryKey: ['app', ownerId, 'products'],
    queryFn: () => fetchProducts(ownerId as string),
    enabled: enabled(ownerId),
    refetchInterval: POLL_MS,
  });
}

function invalidateProducts(
  queryClient: ReturnType<typeof useQueryClient>,
  ownerId: string | null,
) {
  void queryClient.invalidateQueries({ queryKey: ['app', ownerId, 'products'] });
}

export function useCreateProduct(): UseMutationResult<
  string,
  Error,
  Omit<Product, 'id' | 'ownerId'>
> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: (p) => createProduct({ ...p, ownerId: ownerId as string }),
    onSuccess: () => invalidateProducts(queryClient, ownerId),
  });
}

export function useUpdateProduct(): UseMutationResult<
  void,
  Error,
  { id: string; product: Omit<Product, 'id' | 'ownerId'> }
> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: ({ id, product }) =>
      updateProduct(id, { ...product, ownerId: ownerId as string }),
    onSuccess: () => invalidateProducts(queryClient, ownerId),
  });
}

export function useDeleteProduct(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: (id) => deleteProduct(id),
    onSuccess: () => invalidateProducts(queryClient, ownerId),
  });
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export function useInvoices(
  filter: InvoiceFilter = {},
  limit = 20,
): UseQueryResult<Invoice[]> {
  const ownerId = useOwnerId();
  const { from, to, query, status } = filter;
  return useQuery({
    queryKey: [
      'app',
      ownerId,
      'invoices',
      from?.toISOString() ?? null,
      to?.toISOString() ?? null,
      query ?? '',
      status ?? '',
      limit,
    ],
    queryFn: () => fetchInvoices(ownerId as string, filter, limit),
    enabled: enabled(ownerId),
    refetchInterval: POLL_MS,
  });
}

export function useInvoice(id: string | undefined): UseQueryResult<Invoice | null> {
  const ownerId = useOwnerId();
  return useQuery({
    queryKey: ['app', ownerId, 'invoices', id],
    queryFn: () => fetchInvoiceById(id as string),
    enabled: enabled(ownerId) && id != null,
  });
}

function invalidateInvoices(
  queryClient: ReturnType<typeof useQueryClient>,
  ownerId: string | null,
) {
  void queryClient.invalidateQueries({ queryKey: ['app', ownerId, 'invoices'] });
}

export function useCreateInvoice(): UseMutationResult<
  string,
  Error,
  { prefix: string; build: (number: string) => NewInvoice }
> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: ({ prefix, build }) =>
      createInvoiceAtomic(ownerId as string, prefix, build),
    onSuccess: () => invalidateInvoices(queryClient, ownerId),
  });
}

export function useUpdateInvoice(): UseMutationResult<
  void,
  Error,
  { id: string; invoice: NewInvoice }
> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: ({ id, invoice }) => updateInvoice(id, invoice),
    onSuccess: () => invalidateInvoices(queryClient, ownerId),
  });
}

export function useDeleteInvoice(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: (id) => deleteInvoice(id),
    onSuccess: () => invalidateInvoices(queryClient, ownerId),
  });
}

export function useCancelInvoice(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: (id) => cancelInvoice(id),
    onSuccess: () => invalidateInvoices(queryClient, ownerId),
  });
}

export function useSetInvoiceStatus(): UseMutationResult<
  void,
  Error,
  { id: string; status: string }
> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: ({ id, status }) => setInvoiceStatus(id, status),
    onSuccess: () => invalidateInvoices(queryClient, ownerId),
  });
}

export function useDuplicateInvoice(): UseMutationResult<
  string,
  Error,
  { prefix: string; source: Invoice }
> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: ({ prefix, source }) =>
      duplicateInvoice(ownerId as string, prefix, source),
    onSuccess: () => invalidateInvoices(queryClient, ownerId),
  });
}

// ---------------------------------------------------------------------------
// Quotations
// ---------------------------------------------------------------------------

export function useQuotations(
  filter: QuotationFilter = {},
  limit = 20,
): UseQueryResult<Quotation[]> {
  const ownerId = useOwnerId();
  const { from, to, query, status } = filter;
  return useQuery({
    queryKey: [
      'app',
      ownerId,
      'quotations',
      from?.toISOString() ?? null,
      to?.toISOString() ?? null,
      query ?? '',
      status ?? '',
      limit,
    ],
    queryFn: () => fetchQuotations(ownerId as string, filter, limit),
    enabled: enabled(ownerId),
    refetchInterval: POLL_MS,
  });
}

export function useQuotation(id: string | undefined): UseQueryResult<Quotation | null> {
  const ownerId = useOwnerId();
  return useQuery({
    queryKey: ['app', ownerId, 'quotations', id],
    queryFn: () => fetchQuotationById(id as string),
    enabled: enabled(ownerId) && id != null,
  });
}

function invalidateQuotations(
  queryClient: ReturnType<typeof useQueryClient>,
  ownerId: string | null,
) {
  void queryClient.invalidateQueries({ queryKey: ['app', ownerId, 'quotations'] });
}

export function useCreateQuotation(): UseMutationResult<
  string,
  Error,
  { prefix: string; build: (number: string) => NewQuotation }
> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: ({ prefix, build }) =>
      createQuotationAtomic(ownerId as string, prefix, build),
    onSuccess: () => invalidateQuotations(queryClient, ownerId),
  });
}

export function useUpdateQuotation(): UseMutationResult<
  void,
  Error,
  { id: string; quotation: NewQuotation }
> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: ({ id, quotation }) => updateQuotation(id, quotation),
    onSuccess: () => invalidateQuotations(queryClient, ownerId),
  });
}

export function useDeleteQuotation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: (id) => deleteQuotation(id),
    onSuccess: () => invalidateQuotations(queryClient, ownerId),
  });
}

export function useSetQuotationStatus(): UseMutationResult<
  void,
  Error,
  { id: string; status: string }
> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: ({ id, status }) => setQuotationStatus(id, status as never),
    onSuccess: () => invalidateQuotations(queryClient, ownerId),
  });
}

export function useConvertQuotation(): UseMutationResult<
  string,
  Error,
  { quotation: Quotation; invoicePrefix: string }
> {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: ({ quotation, invoicePrefix }) =>
      convertQuotationToInvoice(ownerId as string, quotation, invoicePrefix),
    onSuccess: () => {
      invalidateQuotations(queryClient, ownerId);
      invalidateInvoices(queryClient, ownerId);
    },
  });
}
