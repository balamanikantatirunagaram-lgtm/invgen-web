import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInvoiceAtomic } from '../invoices';
import * as clientModule from '../../supabase/client';

// Mock getSupabase globally for this test file
vi.mock('../../supabase/client', async () => {
  const actual = await vi.importActual('../../supabase/client');
  return {
    ...actual,
    getSupabase: vi.fn(),
  };
});

describe('Invoice Creation Resilience & Idempotency', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const ownerId = 'usr-123';
  const buildMockInvoice = (number: string) => ({
    ownerId,
    invoiceNumber: number,
    invoiceDate: new Date(),
    poNumber: '',
    poDate: null,
    vehicleNumber: '',
    copyType: 'Original',
    billTo: { clientId: 'c1', businessName: 'A', gstin: '', address: '', mobile: '', email: '' },
    shipTo: { clientId: 'c1', businessName: 'A', gstin: '', address: '', mobile: '', email: '' },
    items: [
      { name: 'Item', hsnCode: '', quantity: 1, unit: 'Nos', rate: 100, taxableValue: 100, gstRate: 18, cgstRate: 9, cgstAmount: 9, sgstRate: 9, sgstAmount: 9, igstRate: 0, igstAmount: 0, itemTotal: 118 }
    ],
    isInterstate: false,
    subTotal: 100,
    totalTaxableValue: 100,
    totalCGST: 9,
    totalSGST: 9,
    totalIGST: 0,
    roundOff: 0,
    grandTotal: 118,
    amountInWords: 'One hundred',
    notes: '',
    terms: '',
    bankDetails: '',
    signatureName: '',
    template: 'classic',
    status: 'draft',
  });

  function makeMockChain(overrides: any = {}) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockReturnThis(),
      count: vi.fn().mockResolvedValue({ count: 0, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 'draft-id' }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      ...overrides
    };
  }

  it('A. Normal invoice creation', async () => {
    const draftId = 'draft-normal';
    
    const mockInsert = vi.fn().mockResolvedValue({ data: { id: draftId }, error: null });
    
    vi.mocked(clientModule.getSupabase).mockReturnValue({
      from: (_table: string) => makeMockChain({
        single: mockInsert,
      }),
      rpc: vi.fn().mockResolvedValue({ data: 0 }),
    } as any);

    const id = await createInvoiceAtomic(ownerId, 'INV-', draftId, buildMockInvoice);
    expect(id).toBe(draftId);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('C. Same request twice / E. Lost response idempotent recovery', async () => {
    const draftId = 'draft-recovered';
    
    let insertCalls = 0;
    
    vi.mocked(clientModule.getSupabase).mockReturnValue({
      from: (_table: string) => makeMockChain({
          single: vi.fn().mockImplementation(() => {
             insertCalls++;
             throw { code: '23505', message: 'duplicate key value violates unique constraint' };
          }),
          maybeSingle: vi.fn().mockImplementation(() => {
             return Promise.resolve({ data: { id: draftId }, error: null });
          }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: 0 }),
    } as any);

    const id = await createInvoiceAtomic(ownerId, 'INV-', draftId, buildMockInvoice);
    expect(id).toBe(draftId);
    expect(insertCalls).toBe(1); // Fails once, then recovers gracefully
  });

  it('G. Invoice-number collision sequence loop', async () => {
    const draftId = 'draft-collided';
    
    let insertAttempts = 0;
    
    vi.mocked(clientModule.getSupabase).mockReturnValue({
      from: (_table: string) => makeMockChain({
          single: vi.fn().mockImplementation(() => {
             insertAttempts++;
             if (insertAttempts === 1) {
               throw { code: '23505', message: 'duplicate key value violates unique constraint' };
             }
             return Promise.resolve({ data: { id: draftId }, error: null });
          }),
          maybeSingle: vi.fn().mockImplementation(() => {
             return Promise.resolve({ data: null, error: null });
          }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: 0 }),
    } as any);

    const id = await createInvoiceAtomic(ownerId, 'INV-', draftId, buildMockInvoice);
    expect(id).toBe(draftId);
    expect(insertAttempts).toBe(2);
  });

  it('D. Network failure before server processing', async () => {
    const draftId = 'draft-network-fail';
    
    vi.mocked(clientModule.getSupabase).mockReturnValue({
      from: (_table: string) => makeMockChain({
          single: vi.fn().mockImplementation(() => {
             throw new Error('Failed to fetch');
          }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: 0 }),
    } as any);

    await expect(createInvoiceAtomic(ownerId, 'INV-', draftId, buildMockInvoice)).rejects.toThrow('No internet');
  });
});
