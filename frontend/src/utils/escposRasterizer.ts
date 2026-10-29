/**
 * High-Speed 203 DPI Canvas to 1-Bit Monochrome ESC/POS Rasterizer
 * Converts rendered receipt HTML/Canvas into native GS v 0 raster bytes.
 * Compatible with all standard 80mm (576 dots) and 58mm (384 dots) thermal receipt printers.
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const INIT = [
  ESC, 0x40,                               // Reset / initialize printer
  ESC, 0x37, 0x07, 0xf0, 0x02,             // Max heating dots & pulse duration (2400us for deep black thermal burn)
  GS,  0x28, 0x4b, 0x02, 0x00, 0x31, 0x02, // Set print density to dark (+2)
];
// Single clean cut: GS V 0 (Standard ESC/POS full cut - fires cutter blade exactly once)
const CUT = [GS, 0x56, 0x00];

/**
 * Formats a unit price for receipts, displays, and modals.
 * Cleans floating-point inaccuracies from rupee-to-kg conversions
 * (e.g. 50 / 0.185 = 270.27027027027026 -> "270").
 */
export function formatReceiptUnitPrice(unitPrice: number): string {
  const num = Number(unitPrice);
  if (!num || isNaN(num)) return '0';

  if (Number.isInteger(num)) return num.toString();

  // If very close to an integer (within 0.45, e.g. 270.27027... or 239.808...)
  const rounded = Math.round(num);
  if (Math.abs(num - rounded) < 0.45) {
    return rounded.toString();
  }

  // Otherwise, round to at most 2 decimal places without trailing zeros
  return (Math.round(num * 100) / 100).toString();
}

export interface RasterReceiptOptions {
  widthMm?: '58mm' | '80mm';
  autoCutter?: boolean;
  densityThreshold?: number; // 0-255 (default ~225 for deep crisp solid black)
}

/**
 * Converts an HTML Canvas element (2D Context) to ESC/POS GS v 0 1-bit monochrome bytes.
 */
export function canvasToEscposRaster(
  canvas: HTMLCanvasElement,
  options: RasterReceiptOptions = {}
): number[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  // ESC/POS raster width must be multiple of 8 bits (1 byte)
  const widthBytes = Math.ceil(width / 8);
  const threshold = options.densityThreshold ?? 225; // 225 captures anti-aliased font edges as crisp solid black

  const bytes: number[] = [];

  // 1. Initialise
  bytes.push(...INIT);

  // ---------------------------------------------------------------------------
  // 2. Build monochrome pixel rows first (pack 8 pixels per byte)
  // ---------------------------------------------------------------------------
  const rowBytes: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let xByte = 0; xByte < widthBytes; xByte++) {
      let byteVal = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        if (x < width) {
          const idx = (y * width + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const a = pixels[idx + 3];
          if (a >= 25) {
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum < threshold) {
              byteVal |= 0x80 >> bit;
            }
          }
        }
      }
      row.push(byteVal);
    }
    rowBytes.push(row);
  }

  // ---------------------------------------------------------------------------
  // 3. Send raster data in chunks using GS v 0 (raster bit image)
  //    Chunk size: 255 rows per command to avoid overwhelming the printer
  //    buffer on BC-105 and similar budget 80mm printers.
  // ---------------------------------------------------------------------------
  const CHUNK_ROWS = 255;
  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;

  for (let start = 0; start < height; start += CHUNK_ROWS) {
    const end = Math.min(start + CHUNK_ROWS, height);
    const chunkHeight = end - start;
    const yL = chunkHeight & 0xff;
    const yH = (chunkHeight >> 8) & 0xff;

    // GS v 0 header for this chunk
    bytes.push(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH);

    for (let r = start; r < end; r++) {
      bytes.push(...rowBytes[r]);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Flush raster line buffer with single LF, then issue hardware cut
  // ---------------------------------------------------------------------------
  bytes.push(LF);
  if (options.autoCutter !== false) {
    bytes.push(...CUT);
  }

  return bytes;
}

/**
 * High-speed direct Canvas rasterizer for Receipt Data.
 * Renders the exact layout directly to a high-DPI 203 DPI canvas off-screen in ~5-10ms.
 */
export async function renderReceiptToCanvas(
  sale: {
    id?: number | string;
    checkoutUuid?: string;
    tokenNumber?: number;
    shopName?: string;
    createdAt: string | Date;
    customerName?: string | null;
    items: Array<{ itemName: string; quantity: number; unitPrice: number; totalPrice: number }>;
    totalAmount: number;
    discountAmount?: number;
    paymentMethod?: string;
    currencySymbol?: string;
    footerText?: string;
  },
  receiptWidth: '58mm' | '80mm' = '80mm'
): Promise<HTMLCanvasElement> {
  // Wait for font ready with a fast 100ms timeout guard so receipt generation is instant (~millisecond)
  // even if Google Fonts is resolving, network is flaky, or offline.
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 100))
    ]);
  } catch {
    /* fallback to system font immediately */
  }

  // 80mm = 576 dots printable area, 58mm = 384 dots printable area
  const targetWidth = receiptWidth === '58mm' ? 384 : 576;
  const scale = 1; // 1:1 hardware dot alignment

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  
  // Estimate height and resize dynamically
  const estimatedHeight = 520 + sale.items.length * 52;
  canvas.height = estimatedHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const currency = sale.currencySymbol || 'Rs.';
  const shopName = (sale.shopName || 'GUJAR MILK SHOP').toUpperCase();

  let y = 6;

  // 1. Shop Title (font-black 900)
  ctx.font = '900 34px "Inter", "Arial", sans-serif';
  ctx.fillText(shopName, targetWidth / 2, y);
  y += 42;

  // 2. SALE RECEIPT
  ctx.font = '700 20px "Inter", "Arial", sans-serif';
  ctx.fillText('SALE RECEIPT', targetWidth / 2, y);
  y += 32;

  // 3. Huge Bold TOKEN
  const tokenNum = sale.tokenNumber !== undefined && sale.tokenNumber !== null ? Number(sale.tokenNumber) : 1;
  const tokenFormatted = tokenNum < 10 ? `0${tokenNum}` : `${tokenNum}`;
  ctx.font = '900 64px "Inter", "Arial", sans-serif';
  ctx.fillText(`TOKEN ${tokenFormatted}`, targetWidth / 2, y);
  y += 72;

  // 4. Bill & Date Header
  ctx.font = '700 20px "Inter", "Arial", sans-serif';
  ctx.textAlign = 'left';
  const billLabel = sale.id != null ? `BILL-${sale.id}` : `REF-${(sale.checkoutUuid || '').slice(-8).toUpperCase()}`;
  ctx.fillText(`Bill: ${billLabel}`, 20, y);
  
  ctx.textAlign = 'right';
  const d = new Date(sale.createdAt);
  const day = d.toLocaleDateString('en-GB', { day: '2-digit' });
  let month = d.toLocaleDateString('en-GB', { month: 'short' });
  if (month === 'Sep') month = 'Sept';
  const year = d.toLocaleDateString('en-GB', { year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = `${day} ${month} ${year} ${time}`;
  ctx.fillText(dateStr, targetWidth - 20, y);
  y += 28;

  // Optional Customer Name
  if (sale.customerName) {
    ctx.textAlign = 'left';
    ctx.fillText('Customer:', 20, y);
    ctx.textAlign = 'right';
    ctx.fillText(sale.customerName.toUpperCase(), targetWidth - 20, y);
    y += 28;
  }

  // 5. Solid Divider
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(20, y);
  ctx.lineTo(targetWidth - 20, y);
  ctx.stroke();
  y += 10;

  // 6. PAID Banner
  ctx.textAlign = 'center';
  ctx.font = '900 26px "Inter", "Arial", sans-serif';
  const method = (sale.paymentMethod || 'CASH').toUpperCase();
  ctx.fillText(`PAID: ${method}`, targetWidth / 2, y);
  y += 34;

  // Solid Divider
  ctx.beginPath();
  ctx.moveTo(20, y);
  ctx.lineTo(targetWidth - 20, y);
  ctx.stroke();
  y += 16;

  // 7. Line Items
  for (const item of sale.items) {
    const itemName = item.itemName.toUpperCase();
    const itemTotalStr = `${currency}${item.totalPrice}`;

    // Item Title & Price
    ctx.font = '900 24px "Inter", "Arial", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(itemName, 20, y);
    
    ctx.textAlign = 'right';
    ctx.fillText(itemTotalStr, targetWidth - 20, y);

    // Dot leader between name and total
    const nameWidth = ctx.measureText(itemName).width;
    const totalWidth = ctx.measureText(itemTotalStr).width;
    const startX = 25 + nameWidth;
    const endX = targetWidth - 25 - totalWidth;

    if (endX > startX + 10) {
      ctx.save();
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, y + 16);
      ctx.lineTo(endX, y + 16);
      ctx.stroke();
      ctx.restore();
    }

    y += 28;

    // Sub-line: Quantity x Unit Price (bold, high-contrast, clean rate)
    ctx.font = '800 22px "Inter", "Arial", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${item.quantity} x ${currency}${formatReceiptUnitPrice(item.unitPrice)}`, 20, y);
    y += 32;
  }

  // 8. Discount if present
  if (sale.discountAmount && sale.discountAmount > 0) {
    ctx.font = '700 20px "Inter", "Arial", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Discount', 20, y);
    ctx.textAlign = 'right';
    ctx.fillText(`-${currency}${sale.discountAmount}`, targetWidth - 20, y);
    y += 28;
  }

  // 9. Solid Divider before TOTAL
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(20, y);
  ctx.lineTo(targetWidth - 20, y);
  ctx.stroke();
  y += 12;

  // 10. Giant Bold TOTAL
  ctx.font = '900 46px "Inter", "Arial", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL', 20, y);
  ctx.textAlign = 'right';
  ctx.fillText(`${currency}${sale.totalAmount}`, targetWidth - 20, y);
  y += 56;

  // 11. Barcode
  const barcodeText = sale.id != null ? `BILL-${sale.id}` : (sale.checkoutUuid ? `REF-${sale.checkoutUuid.slice(-8).toUpperCase()}` : 'POS-RECEIPT');
  drawCode39Barcode(ctx, barcodeText, 20, y, targetWidth - 40, 54);
  y += 62;

  // 12. Scan Instruction
  ctx.font = '700 16px "Inter", "Arial", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCAN FOR RETURN / AUDIT', targetWidth / 2, y);
  y += 28;

  // 13. Footer Message
  ctx.font = '700 22px "Inter", "Arial", sans-serif';
  ctx.fillText(sale.footerText || 'Thank you for your visit!', targetWidth / 2, y);
  y += 36;

  // 14. Bottom margin — minimal 0.2 cm blank space (~16px at 203 DPI) before cut
  y += 16;

  // Final trim canvas height
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetWidth;
  finalCanvas.height = y;
  const finalCtx = finalCanvas.getContext('2d');
  if (finalCtx) {
    finalCtx.drawImage(canvas, 0, 0);
  }
  return finalCanvas;
}

const CODE39_PATTERNS: Record<string, string> = {
  '0': '101001101101', '1': '110100101011', '2': '101100101011',
  '3': '110110010101', '4': '101001101011', '5': '110100110101',
  '6': '101100110101', '7': '101001011011', '8': '110100101101',
  '9': '101100101101', 'A': '110101001011', 'B': '101101001011',
  'C': '110110100101', 'D': '101011001011', 'E': '110101100101',
  'F': '101101100101', 'G': '101010011011', 'H': '110101001101',
  'I': '101101001101', 'J': '101011001101', 'K': '110101010011',
  'L': '101101010011', 'M': '110110101001', 'N': '101011010011',
  'O': '110101101001', 'P': '101101101001', 'Q': '101010110011',
  'R': '110101011001', 'S': '101101011001', 'T': '101011011001',
  'U': '110010101011', 'V': '100110101011', 'W': '110011010101',
  'X': '100101101011', 'Y': '110010110101', 'Z': '100110110101',
  '-': '100101011011', '.': '110010101101', ' ': '100110101101',
  '*': '100101101101', '$': '100100100101', '/': '100100101001',
  '+': '100101001001', '%': '101001001001'
};

function drawCode39Barcode(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  availWidth: number,
  height: number
) {
  const clean = text.toUpperCase().replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '');
  const encoded = `*${clean}*`;

  let binary = '';
  for (let i = 0; i < encoded.length; i++) {
    const pattern = CODE39_PATTERNS[encoded[i]] || CODE39_PATTERNS['-'];
    binary += pattern + '0';
  }

  const barWidth = 2.4;
  const totalBarcodeWidth = binary.length * barWidth;
  const startX = Math.max(x, x + (availWidth - totalBarcodeWidth) / 2);

  ctx.fillStyle = '#000000';
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      ctx.fillRect(startX + i * barWidth, y, barWidth, height);
    }
  }
}
