/**
 * ESC/POS Byte Builder for Thermal Printers (58mm & 80mm).
 */

// ---------------------------------------------------------------------------
// ESC/POS Constants
// ---------------------------------------------------------------------------
const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;

// Initialise printer
const INIT         = [ESC, 0x40];

// Alignment
const ALIGN_LEFT   = [ESC, 0x61, 0x00];
const ALIGN_CENTER = [ESC, 0x61, 0x01];
const ALIGN_RIGHT  = [ESC, 0x61, 0x02];

// Text Weights
const BOLD_ON      = [ESC, 0x45, 0x01, ESC, 0x47, 0x01]; // Emphasized + Double-strike
const BOLD_OFF     = [ESC, 0x45, 0x00, ESC, 0x47, 0x00];
const SEMIBOLD_ON  = [ESC, 0x47, 0x01];                  // Double-strike only
const SEMIBOLD_OFF = [ESC, 0x47, 0x00];
const NORMAL_ON    = [ESC, 0x45, 0x00, ESC, 0x47, 0x00];

// Size
const DOUBLE_ON    = [GS,  0x21, 0x11]; // Double height + Double width
const DOUBLE_OFF   = [GS,  0x21, 0x00];
const DBL_HEIGHT   = [GS,  0x21, 0x01]; // Double height only

// Auto cut
const CUT          = [GS,  0x56, 0x00];

// Line feed
const newline = (): number[] => [LF];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encode a string to CP437-compatible bytes (ASCII safe) */
function encodeText(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    bytes.push(c < 128 ? c : 0x3f /* '?' */);
  }
  return bytes;
}

/** Left-pad a string to a fixed width */
function padLeft(str: string, width: number): string {
  return str.padStart(width, ' ');
}

/** Wrap a long string into multiple lines of at most `width` chars */
function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > width) {
    lines.push(remaining.slice(0, width));
    remaining = remaining.slice(width);
  }
  if (remaining) lines.push(remaining);
  return lines;
}

/** Print a centered string padded to columns */
function centeredLine(text: string, cols: number): number[] {
  const truncated = text.slice(0, cols);
  const leftPad = Math.floor((cols - truncated.length) / 2);
  const padded = ' '.repeat(Math.max(0, leftPad)) + truncated;
  return encodeText(padded.padEnd(cols, ' '));
}

/** Print a separator line */
function separator(char: string = '-', cols: number = 48): number[] {
  return [...encodeText(char.repeat(cols)), ...newline()];
}

/**
 * Print a two-column row: left text and right text.
 */
function twoCol(left: string, right: string, cols: number): number[] {
  const rightWidth = right.length + 1; // +1 for space
  const leftWidth  = Math.max(1, cols - rightWidth);
  const bytes: number[] = [];

  const leftLines = wrapText(left, leftWidth);
  leftLines.forEach((line, idx) => {
    if (idx === leftLines.length - 1) {
      const row = line.padEnd(leftWidth, ' ') + padLeft(right, rightWidth);
      bytes.push(...encodeText(row), ...newline());
    } else {
      bytes.push(...encodeText(line.padEnd(cols, ' ')), ...newline());
    }
  });
  return bytes;
}

/**
 * Dotted leader row:
 * "FRESH MILK ........................ Rs.840"
 */
function dottedRow(left: string, right: string, cols: number): number[] {
  const rightStr = ' ' + right;
  const maxLeftWidth = cols - rightStr.length;

  if (left.length >= maxLeftWidth) {
    const trimmed = left.slice(0, Math.max(1, maxLeftWidth - 4)) + '...';
    const dots = Math.max(1, cols - trimmed.length - rightStr.length);
    const row = trimmed + '.'.repeat(dots) + rightStr;
    return [...encodeText(row), ...newline()];
  }

  const dots = Math.max(1, cols - left.length - rightStr.length);
  const row = left + '.'.repeat(dots) + rightStr;
  return [...encodeText(row), ...newline()];
}

function formatReceiptDate(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '03 Sept 2026 03:56 AM';
  const day = d.toLocaleDateString('en-GB', { day: '2-digit' });
  let month = d.toLocaleDateString('en-GB', { month: 'short' });
  if (month === 'Sep') month = 'Sept';
  const year = d.toLocaleDateString('en-GB', { year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${day} ${month} ${year} ${time}`;
}

/**
 * Build ESC/POS Barcode (Code39)
 */
function buildBarcode(text: string): number[] {
  const clean = text.toUpperCase().replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '');
  if (!clean) return [];

  const bytes: number[] = [];
  bytes.push(...ALIGN_CENTER);
  bytes.push(GS, 0x68, 34);   // Height: 34 dots (matching 34px in Preview)
  bytes.push(GS, 0x77, 2);    // Width multiplier: 2
  bytes.push(GS, 0x48, 0x00); // No automatic HRI text below
  // ESC/POS CODE39 format 1 (Null-terminated)
  bytes.push(GS, 0x6b, 0x04, ...encodeText(clean), 0x00);
  bytes.push(...newline());
  return bytes;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ReceiptSale {
  id: number;
  tokenNumber?: number;
  shopName?: string;
  createdAt: string | Date;
  customerName?: string | null;
  cashierName?: string | null;
  items: Array<{
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  discountAmount?: number;
  paidAmount: number;
  remainingBalance: number;
  paymentMethod?: string;
  currencySymbol?: string;
  receiptWidth?: '58mm' | '80mm';
  footerText?: string;
  autoCutter?: boolean;
}

/**
 * Build the raw ESC/POS byte array for a receipt matching ReceiptPreview.
 */
export function buildReceipt(sale: ReceiptSale): number[] {
  const bytes: number[] = [];
  const push = (...chunks: number[][]) => chunks.forEach(c => bytes.push(...c));

  const cols = sale.receiptWidth === '58mm' ? 32 : 48;
  const currency = sale.currencySymbol || 'Rs.';

  // ── 1. Init ───────────────────────────────────────────────────────────────
  push(INIT);

  // ── 2. Compact receipt header ─────────────────────────────────────────────
  push(ALIGN_CENTER);

  const shopName = (sale.shopName || 'GUJAR MILK SHOP').toUpperCase();
  push(BOLD_ON);
  push(centeredLine(shopName, cols), newline());
  
  push(centeredLine('SALE RECEIPT', cols), newline());
  push(BOLD_OFF);

  // ── 3. Token number ───────────────────────────────────────────────────────
  if (sale.tokenNumber !== undefined && sale.tokenNumber !== null) {
    const tokenNum = Number(sale.tokenNumber);
    const tokenFormatted = tokenNum < 10 ? `0${tokenNum}` : `${tokenNum}`;
    push(BOLD_ON, DOUBLE_ON);
    push(centeredLine(`TOKEN ${tokenFormatted}`, Math.floor(cols / 2)), newline());
    push(DOUBLE_OFF, BOLD_OFF);
  }

  // ── 4. Bill, Date, and Customer ───────────────────────────────────────────
  push(ALIGN_LEFT);
  const formattedDate = formatReceiptDate(sale.createdAt);

  push(BOLD_ON);
  push(twoCol(`Bill: BILL-${sale.id}`, formattedDate, cols));
  
  if (sale.customerName) {
    push(twoCol(`Customer:`, sale.customerName.toUpperCase(), cols));
  }
  push(BOLD_OFF);

  // ── 5. Payment method ─────────────────────────────────────────────────────
  push(NORMAL_ON);
  push(separator('-', cols));
  push(ALIGN_CENTER, BOLD_ON);
  const method = (sale.paymentMethod || 'CASH').toUpperCase();
  push(centeredLine(`PAID: ${method}`, cols), newline());
  push(BOLD_OFF, NORMAL_ON);
  push(separator('-', cols));

  // ── 6. Compact item rows ──────────────────────────────────────────────────
  push(ALIGN_LEFT);
  for (const item of sale.items) {
    const itemUpper = item.itemName.toUpperCase();
    const itemTotalStr = `${currency}${item.totalPrice}`;
    
    // Line 1: ITEM NAME ..................... Rs.XXX (BOLD)
    push(BOLD_ON);
    push(dottedRow(itemUpper, itemTotalStr, cols));
    push(BOLD_OFF);
    
    // Line 2: 3.5 x Rs.240 (SEMI-BOLD)
    const subLine = `${item.quantity} x ${currency}${item.unitPrice}`;
    push(SEMIBOLD_ON);
    push(encodeText(subLine), newline());
    push(SEMIBOLD_OFF);
  }

  // ── 7. Discount & Total ───────────────────────────────────────────────────
  if (sale.discountAmount && sale.discountAmount > 0) {
    push(BOLD_ON);
    push(twoCol('Discount', `-${currency}${sale.discountAmount}`, cols));
    push(BOLD_OFF);
  }

  push(NORMAL_ON);
  push(separator('-', cols));

  push(BOLD_ON, DOUBLE_ON);
  push(twoCol('TOTAL', `${currency}${sale.totalAmount}`, Math.floor(cols / 2)));
  push(DOUBLE_OFF, BOLD_OFF);

  // ── 8. Barcode and return instruction ─────────────────────────────────────
  try {
    const barcodeCode = `BILL-${sale.id}`;
    push(buildBarcode(barcodeCode));
    push(ALIGN_CENTER);
    push(SEMIBOLD_ON);
    push(encodeText('SCAN FOR RETURN / AUDIT'), newline());
    push(SEMIBOLD_OFF);
  } catch (_) {}

  // ── 9. Footer ─────────────────────────────────────────────────────────────
  push(ALIGN_CENTER, SEMIBOLD_ON);
  const footer = sale.footerText || 'Thank you for your visit!';
  const footerLines = wrapText(footer, cols);
  footerLines.forEach(line => push(centeredLine(line, cols), newline()));
  push(SEMIBOLD_OFF);

  // ── 10. Feed Paper & Cut ──────────────────────────────────────────────────
  push(newline(), newline(), newline());
  if (sale.autoCutter !== false) {
    push(CUT);
  }

  return bytes;
}

/**
 * Build a test receipt for verifying printer connection & config.
 */
export function buildTestPage(
  printerName: string,
  autoCutter: boolean,
  shopName: string = 'GUJAR MILK SHOP',
  footerText: string = 'Thank you for your visit!',
  currencySymbol: string = 'Rs.',
  receiptWidth: '58mm' | '80mm' = '80mm'
): number[] {
  return buildReceipt({
    id: 99999,
    tokenNumber: 1,
    shopName,
    createdAt: new Date(),
    customerName: 'Test Customer',
    cashierName: 'Admin',
    items: [
      { itemName: 'FRESH MILK', quantity: 3.5, unitPrice: 240, totalPrice: 840 },
      { itemName: 'FRESH YOGURT', quantity: 1, unitPrice: 270, totalPrice: 270 }
    ],
    totalAmount: 1110,
    paidAmount: 1110,
    remainingBalance: 0,
    paymentMethod: 'CASH',
    currencySymbol,
    receiptWidth,
    footerText,
    autoCutter
  });
}

