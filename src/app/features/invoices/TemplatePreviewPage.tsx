
import { useSearchParams } from 'react-router-dom';
import { PDFViewer } from '@react-pdf/renderer';
import { InvoiceDocument } from '../../pdf/invoiceDocument';
import { useTemplates } from '../../hooks/useTemplates';

export default function TemplatePreviewPage() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const { data: templates = [] } = useTemplates();
  const templateDef = templates.find(t => t.id === id);

  if (!templateDef) {
    return <div className="p-10 text-center">Loading template preview...</div>;
  }

  const dummyInv: any = {
    invoiceNumber: 'INV-2026-001',
    invoiceDate: new Date(),
    grandTotal: 35000,
    subTotal: 37000,
    totalDiscount: 2000,
    totalTax: 0,
    amountInWords: 'Thirty Five Thousand Rupees',
    shipTo: { businessName: 'Acme Enterprises', address: '456 Business Park, Hyderabad', mobile: '+91 91234 56789' },
    items: [
      { name: 'Website Development', quantity: 1, rate: 25000, itemTotal: 25000 },
      { name: 'UI/UX Design', quantity: 1, rate: 10000, itemTotal: 10000 }
    ]
  };

  const dummyCompany: any = {
    companyName: 'Driti Tech Solutions',
    address: '123 Innovation Street, Visakhapatnam',
    mobile: '+91 98765 43210',
    email: 'hello@driti.in',
    gstin: '29GGGGG1314R9Z6',
    bankDetails: { bankName: 'HDFC Bank', accountNumber: '1234 5678 9012', ifscCode: 'HDFC0001234' }
  };

  return (
    <div className="w-screen h-screen">
      <PDFViewer style={{ width: '100%', height: '100%', border: 'none' }}>
        <InvoiceDocument inv={dummyInv} company={dummyCompany} templateDef={templateDef} />
      </PDFViewer>
    </div>
  );
}
