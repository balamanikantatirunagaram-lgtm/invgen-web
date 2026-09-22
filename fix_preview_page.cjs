const fs = require('fs');
const file = 'src/app/features/invoices/TemplatePreviewPage.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { PDFViewer } from '@react-pdf/renderer';",
  "import { usePDF } from '@react-pdf/renderer';"
);

content = content.replace(
  /<PDFViewer[\s\S]*?<\/PDFViewer>/,
  `{(() => {
        const [instance] = usePDF({ document: <InvoiceDocument inv={dummyInv} company={dummyCompany} templateDef={templateDef} /> });
        if (instance.loading) return <div className="p-10 flex items-center justify-center">Generating PDF preview...</div>;
        if (instance.error) return <div className="p-10 text-red-500">Error generating PDF: {instance.error.message}</div>;
        return <iframe src={instance.url} style={{ width: '100%', height: '100%', border: 'none' }} />;
      })()}`
);

fs.writeFileSync(file, content);
console.log("Preview page updated to usePDF hook");
