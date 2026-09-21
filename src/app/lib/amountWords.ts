/**
 * Indian numbering converter: number → words (crore / lakh).
 * TypeScript port of INVGEN-APP `lib/core/tax/indian_amount_words.dart`.
 *
 * Example: 23955 → "TWENTY THREE THOUSAND NINE HUNDRED FIFTY FIVE RUPEES ONLY"
 * Used for `amountInWords` on invoices. Pure functions.
 */

const ONES = [
  '',
  'ONE',
  'TWO',
  'THREE',
  'FOUR',
  'FIVE',
  'SIX',
  'SEVEN',
  'EIGHT',
  'NINE',
  'TEN',
  'ELEVEN',
  'TWELVE',
  'THIRTEEN',
  'FOURTEEN',
  'FIFTEEN',
  'SIXTEEN',
  'SEVENTEEN',
  'EIGHTEEN',
  'NINETEEN',
];

const TENS = [
  '',
  '',
  'TWENTY',
  'THIRTY',
  'FORTY',
  'FIFTY',
  'SIXTY',
  'SEVENTY',
  'EIGHTY',
  'NINETY',
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o === 0 ? TENS[t] : `${TENS[t]} ${ONES[o]}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h > 0) {
    parts.push(`${ONES[h]} HUNDRED`);
    if (r > 0) parts.push(twoDigits(r));
  } else if (r > 0) {
    parts.push(twoDigits(r));
  }
  return parts.join(' ');
}

/** Convert integer rupees (0..999999999) to words without suffix. */
export function convertNumber(n: number): string {
  if (!Number.isInteger(n)) n = Math.trunc(n);
  if (n === 0) return 'ZERO';
  if (n < 0) return `MINUS ${convertNumber(-n)}`;

  const parts: string[] = [];
  let rem = n;

  const crore = Math.floor(rem / 10000000);
  rem %= 10000000;
  if (crore > 0) parts.push(`${threeDigits(crore)} CRORE`);

  const lakh = Math.floor(rem / 100000);
  rem %= 100000;
  if (lakh > 0) parts.push(`${twoDigits(lakh)} LAKH`);

  const thousand = Math.floor(rem / 1000);
  rem %= 1000;
  if (thousand > 0) parts.push(`${twoDigits(thousand)} THOUSAND`);

  if (rem > 0) parts.push(threeDigits(rem));

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Convert grand total to invoice words: "... RUPEES ONLY".
 * Amount is rounded to nearest rupee (paise ignored, standard for GST).
 */
export function convertAmount(amount: number): string {
  const rupees = Math.round(amount);
  if (rupees === 0) return 'ZERO RUPEES ONLY';
  return `${convertNumber(rupees)} RUPEES ONLY`;
}
