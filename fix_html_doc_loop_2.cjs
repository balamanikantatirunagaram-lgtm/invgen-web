const fs = require('fs');
const file = 'src/app/pdf/invoiceDocument.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacementLogic = `
    // Process loops first: {{#each inv.items}} ... {{/each}}
    htmlContent = htmlContent.replace(/\\{\\{#each inv\\.items\\}\\}([\\s\\S]*?)\\{\\{\\/each\\}\\}/g, (match, loopContent) => {
      if (!inv.items || !inv.items.length) return '';
      return inv.items.map((item, idx) => {
        let row = loopContent;
        row = row.replace(/\\{\\{index\\}\\}/g, (idx + 1).toString());
        row = row.replace(/\\{\\{item\\.name\\}\\}/g, item.name || 'Item');
        row = row.replace(/\\{\\{item\\.qty\\}\\}/g, item.quantity.toString());
        row = row.replace(/\\{\\{item\\.rate\\}\\}/g, m(item.rate));
        row = row.replace(/\\{\\{item\\.total\\}\\}/g, m(item.itemTotal));
        return row;
      }).join('');
    });

    const replacements = {
      'inv.invoiceNumber': inv.invoiceNumber,
      'inv.invoiceDate': fmtDate(inv.invoiceDate),
      'inv.grandTotal': m(inv.grandTotal),
      'inv.subtotal': m(inv.subTotal),
      'inv.totalTax': m(inv.totalCGST + inv.totalSGST + inv.totalIGST),
      'company.companyName': company.companyName,
      'company.address': company.address || '',
      'company.phone': company.mobile || '',
      'company.email': company.email || '',
      'company.gstin': company.gstin || '',
      'company.bankName': company.bankDetails?.bankName || '',
      'company.bankAccountNumber': company.bankDetails?.accountNumber || '',
      'company.bankIfsc': company.bankDetails?.ifscCode || '',
      'inv.shipTo.businessName': inv.shipTo.businessName || '',
      'inv.shipTo.address': inv.shipTo.address || '',
      'inv.shipTo.mobile': inv.shipTo.mobile || '',
      'inv.amountInWords': inv.amountInWords || '',
      'primaryColor': templateDef.style_config?.primaryColor || '#000000',
    };
`;

content = content.replace(
  /\/\/ Process loops first: \{\{#each inv\.items\}\}[\s\S]*?'primaryColor': templateDef\.style_config\?\.primaryColor \|\| '#000000',\n    \};/,
  replacementLogic
);

fs.writeFileSync(file, content);
