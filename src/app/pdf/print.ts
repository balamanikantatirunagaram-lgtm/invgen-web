/**
 * Browser download + print for generated PDF bytes.
 * (Web equivalent of mobile PrintService preview/printDirect.)
 */

/** Trigger a file download for the PDF bytes. */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  // slice() copies into a fresh buffer so views with offsets stay exact.
  const blob = new Blob([bytes.slice()], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Open the system print dialog for the PDF via a hidden iframe. */
export function printPdf(bytes: Uint8Array, filename: string): Promise<void> {
  void filename;
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = url;
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          reject(e instanceof Error ? e : new Error('Print failed.'));
          return;
        }
        setTimeout(() => {
          iframe.remove();
          URL.revokeObjectURL(url);
          resolve();
        }, 1000);
      };
      iframe.onerror = () => {
        iframe.remove();
        URL.revokeObjectURL(url);
        reject(new Error('Could not load the PDF for printing.'));
      };
      document.body.appendChild(iframe);
    } catch (e) {
      reject(e instanceof Error ? e : new Error('Print failed.'));
    }
  });
}
