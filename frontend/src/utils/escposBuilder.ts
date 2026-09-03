/**
 * ESC/POS Byte Builder for 80mm Thermal Printers (e.g. Black Copper BC-105)
 *
 * Produces a raw byte array that can be sent directly to the Windows Print
 * Spooler via the Tauri `print_raw_bytes` command with datatype "RAW".
 *
 * Paper width : 80 mm
 * Print width : ~48 chars (standard CP437 font, 80mm paper)
 */

// ---------------------------------------------------------------------------
// ESC/POS Constants
// ---------------------------------------------------------------------------
const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;

// Initialise printer
const INIT           = [ESC, 0x40];

// Alignment
const ALIGN_LEFT     = [ESC, 0x61, 0x00];
const ALIGN_CENTER   = [ESC, 0x61, 0x01];
const ALIGN_RIGHT    = [ESC, 0x61, 0x02];

// Bold
const BOLD_ON        = [ESC, 0x45, 0x01];
const BOLD_OFF       = [ESC, 0x45, 0x00];

// Double-height + double-width (big title text)
const DOUBLE_ON      = [GS,  0x21, 0x11];
const DOUBLE_OFF     = [GS,  0x21, 0x00];

// Auto cut (full cut)
const CUT            = [GS,  0x56, 0x00];

// Line feed
const newline = (): number[] => [LF];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const COLS = 48; // characters per line on 80mm paper

/** Encode a string to CP437-compatible bytes (ASCII safe). Non-ASCII chars → '?' */
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
  while (text.length > width) {
    lines.push(text.slice(0, width));
    text = text.slice(width);
  }
  if (text) lines.push(text);
  return lines;
}

/** Print a centered string padded to COLS */
function centeredLine(text: string): number[] {
  const padded = text.slice(0, COLS).padStart(Math.floor((COLS + text.length) / 2), ' ').padEnd(COLS, ' ');
  return encodeText(padded);
}

/** Print a separator line */
function separator(char: string = '-'): number[] {
  return [...encodeText(char.repeat(COLS)), ...newline()];
}

/**
 * Print a two-column row: left text and right text.
 * If the left text is too long it wraps; the right is always right-aligned.
 */
function twoCol(left: string, right: string): number[] {
  const rightWidth = right.length + 1; // +1 for space
  const leftWidth  = COLS - rightWidth;
  const bytes: number[] = [];

  const leftLines = wrapText(left, leftWidth);
  leftLines.forEach((line, idx) => {
    if (idx === leftLines.length - 1) {
      // Last line: include the right-aligned right column
      const row = line.padEnd(leftWidth, ' ') + padLeft(right, rightWidth);
      bytes.push(...encodeText(row), ...newline());
    } else {
      bytes.push(...encodeText(line.padEnd(COLS, ' ')), ...newline());
    }
  });
  return bytes;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ReceiptSale {
  id: number;
  tokenNumber?: number;
  shopName: string;
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
  footerText?: string;
  autoCutter?: boolean;
}

/**
 * Build the raw ESC/POS byte array for an 80mm receipt.
 * Returns a Uint8Array suitable for `print_raw_bytes`.
 */
export function buildReceipt(sale: ReceiptSale): number[] {
  const bytes: number[] = [];

  const push = (...chunks: number[][]) => chunks.forEach(c => bytes.push(...c));

  // ── Init ──────────────────────────────────────────────────────────────────
  push(INIT);
  push(newline());

  // ── Shop Name (big) ───────────────────────────────────────────────────────
  push(ALIGN_CENTER);
  push(DOUBLE_ON);
  push(encodeText(sale.shopName.slice(0, 24)), newline());
  push(DOUBLE_OFF);
  push(newline());

  // ── Token Number (big) ────────────────────────────────────────────────────
  if (sale.tokenNumber !== undefined) {
    push(ALIGN_CENTER);
    push(DOUBLE_ON);
    push(encodeText(`Token: ${sale.tokenNumber}`), newline());
    push(DOUBLE_OFF);
    push(newline());
  }

  // ── Receipt header ────────────────────────────────────────────────────────
  push(BOLD_ON);
  push(centeredLine('RECEIPT'), newline());
  push(BOLD_OFF);

  push(separator());

  // ── Bill info ─────────────────────────────────────────────────────────────
  push(ALIGN_LEFT);

  const date = new Date(sale.createdAt);
  const dateStr = date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });

  push(twoCol(`Bill#: ${sale.id}`, dateStr));
  push(twoCol('Time:', timeStr));

  if (sale.customerName) {
    push(twoCol('Customer:', sale.customerName.slice(0, 24)));
  }
  if (sale.cashierName) {
    push(twoCol('Cashier:', sale.cashierName.slice(0, 24)));
  }

  push(separator());

  // ── Items header ──────────────────────────────────────────────────────────
  push(BOLD_ON);
  // "Item             Qty   Price   Total"
  const headerRow = 'Item'.padEnd(22) + 'Qty'.padEnd(6) + 'Price'.padEnd(9) + 'Total';
  push(encodeText(headerRow), newline());
  push(BOLD_OFF);
  push(separator('-'));

  // ── Items ─────────────────────────────────────────────────────────────────
  for (const item of sale.items) {
    const nameLines = wrapText(item.itemName, 22);
    const qty       = item.quantity.toFixed(2).padEnd(6);
    const price     = item.unitPrice.toFixed(2).padEnd(9);
    const total     = item.totalPrice.toFixed(2);

    nameLines.forEach((line, idx) => {
      if (idx === 0) {
        push(encodeText(line.padEnd(22) + qty + price + total), newline());
      } else {
        push(encodeText('  ' + line), newline());
      }
    });
  }

  push(separator('-'));

  // ── Totals ────────────────────────────────────────────────────────────────
  push(ALIGN_LEFT);

  const subtotal = sale.items.reduce((s, i) => s + i.totalPrice, 0);
  push(twoCol('Subtotal:', `Rs ${subtotal.toFixed(2)}`));

  if (sale.discountAmount && sale.discountAmount > 0) {
    push(twoCol('Discount:', `Rs ${sale.discountAmount.toFixed(2)}`));
  }

  push(BOLD_ON);
  push(twoCol('TOTAL:', `Rs ${sale.totalAmount.toFixed(2)}`));
  push(BOLD_OFF);

  push(separator('-'));

  push(twoCol('Paid:', `Rs ${sale.paidAmount.toFixed(2)}`));

  if (sale.remainingBalance > 0) {
    push(twoCol('Balance:', `Rs ${sale.remainingBalance.toFixed(2)}`));
  } else if (sale.remainingBalance < 0) {
    push(twoCol('Change:', `Rs ${Math.abs(sale.remainingBalance).toFixed(2)}`));
  }

  if (sale.paymentMethod) {
    push(twoCol('Method:', sale.paymentMethod.toUpperCase()));
  }

  push(separator());

  // ── Footer ────────────────────────────────────────────────────────────────
  push(ALIGN_CENTER);
  const footer = sale.footerText || 'Thank you for your visit!';
  const footerLines = wrapText(footer, COLS);
  footerLines.forEach(line => push(centeredLine(line), newline()));

  push(newline(), newline(), newline()); // Feed paper before cut

  // ── Auto cutter ───────────────────────────────────────────────────────────
  if (sale.autoCutter) {
    push(CUT);
  }

  return bytes;
}

/**
 * Build a minimal test page for verifying the printer connection.
 */
export function buildTestPage(printerName: string, autoCutter: boolean): number[] {
  const bytes: number[] = [];
  const push = (...chunks: number[][]) => chunks.forEach(c => bytes.push(...c));

  push(INIT, newline());
  push(ALIGN_CENTER);

  push(separator('-'));
  push(BOLD_ON, DOUBLE_ON);
  push(encodeText('GUJAR MILK SHOP'), newline());
  push(DOUBLE_OFF, BOLD_OFF);
  push(separator('-'));
  push(newline());
  push(encodeText('PRINTER TEST'), newline());
  push(encodeText('BC-105'), newline());
  push(encodeText('80MM'), newline());
  push(newline());
  push(separator('-'));
  push(newline());
  push(BOLD_ON);
  push(encodeText('TEST PRINT SUCCESSFUL'), newline());
  push(BOLD_OFF);
  push(newline());
  push(separator('-'));
  push(newline(), newline(), newline());

  if (autoCutter) {
    push(CUT);
  }

  return bytes;
}
