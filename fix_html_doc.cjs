const fs = require('fs');
const file = 'src/app/pdf/invoiceDocument.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import Html
if (!content.includes('import Html')) {
  content = content.replace('import { Document, Page, Text, View, Image, StyleSheet, Font } from \'@react-pdf/renderer\';', "import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';\nimport Html from 'react-pdf-html';");
}

// Update InvoiceDocument
const customHtmlLogic = `
  const logoSrc = logoDataUrl(company.logoBase64);
  const today = fmtDate(new Date());

  if (templateDef.base_layout === 'custom_html') {
    let htmlContent = templateDef.style_config?.html || '<h1>No Custom HTML Found</h1>';
    
    // Simple interpolation
    const m = (val) => Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const replacements = {
      'inv.invoiceNumber': inv.invoiceNumber,
      'inv.grandTotal': m(inv.grandTotal),
      'company.companyName': company.companyName,
      'company.gstin': company.gstin || '',
      'inv.shipTo.name': inv.shipTo.name || '',
      'inv.amountInWords': inv.amountInWords,
      'primaryColor': templateDef.style_config?.primaryColor || '#000000',
    };
    
    for (const [key, val] of Object.entries(replacements)) {
      htmlContent = htmlContent.replace(new RegExp('\\\\{\\\\{' + key + '\\\\}\\\\}', 'g'), val);
    }

    return (
      <Document title={\`\${docTitle} \${inv.invoiceNumber}\`}>
        <Page size="A4" style={{ padding: 30 }}>
          <Html>{htmlContent}</Html>
        </Page>
      </Document>
    );
  }
`;

content = content.replace('const logoSrc = logoDataUrl(company.logoBase64);\n  const today = fmtDate(new Date());', customHtmlLogic);

fs.writeFileSync(file, content);
console.log("HTML Doc fixed");
