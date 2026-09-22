import { createElement } from 'react';
import { pdf, Document, Page, Text, View } from '@react-pdf/renderer';
import Html from 'react-pdf-html';

const htmlString = `
<div style="font-family: Helvetica; padding: 20px;">
  <!-- Header Section -->
  <div style="border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 25px;">
    <h1 style="color: #000; font-size: 32px; margin: 0; text-transform: uppercase; letter-spacing: 2px;">
      TAX INVOICE
    </h1>
    <p style="font-size: 14px; color: #555; margin-top: 5px;">
      Invoice #: <b>INV-001</b>
    </p>
  </div>
</div>
`;

const Doc = () => createElement(
  Document,
  null,
  createElement(Page, { size: "A4" }, createElement(Html, null, htmlString))
);

async function run() {
  try {
    const instance = pdf(createElement(Doc));
    await instance.toBuffer();
    console.log("SUCCESS!");
  } catch (err) {
    console.error("ERROR:", err);
  }
}

run();
