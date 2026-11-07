import { posConfigService, POSConfigData } from '../services/posConfig.service';
import { canvasToEscposRaster } from './escposRasterizer';

export interface KhataReceiptData {
  receiptNo?: string | number;
  customerName: string;
  customerPhone?: string | null;
  customerType?: string; // 'Monthly' | 'Daily'
  date?: string | Date;
  previousBalance: number;
  paidAmount: number;
  discountAmount?: number;
  remainingBalance: number;
  paymentMethod?: string; // 'cash' | 'online'
}

/**
 * Format receipt date matching POS style
 */
function formatKhataDate(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return new Date().toLocaleDateString();
  const day = d.toLocaleDateString('en-GB', { day: '2-digit' });
  let month = d.toLocaleDateString('en-GB', { month: 'short' });
  if (month === 'Sep') month = 'Sept';
  const year = d.toLocaleDateString('en-GB', { year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${day} ${month} ${year} ${time}`;
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

function drawCode39(
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

/**
 * Render Khata payment receipt directly to high-DPI canvas
 */
export async function renderKhataReceiptToCanvas(
  data: KhataReceiptData,
  config: POSConfigData | null,
  receiptWidth: '58mm' | '80mm' = '80mm'
): Promise<HTMLCanvasElement> {
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 80))
    ]);
  } catch {
    // Immediate fallback
  }

  const targetWidth = receiptWidth === '58mm' ? 384 : 576;
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = 700;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const currency = config?.currencySymbol || 'Rs.';
  const shopName = (config?.shopName || 'GUJAR MILK SHOP').toUpperCase();

  let y = 10;

  // 1. Shop Title
  ctx.font = '900 34px "Inter", "Arial", sans-serif';
  ctx.fillText(shopName, targetWidth / 2, y);
  y += 42;

  // 2. Subtitle
  ctx.font = '700 20px "Inter", "Arial", sans-serif';
  ctx.fillText('KHATA PAYMENT SLIP', targetWidth / 2, y);
  y += 30;

  // 3. Receipt No & Date
  const receiptLabel = data.receiptNo ? `RECEIPT #${data.receiptNo}` : 'PAYMENT SLIP';
  ctx.font = '900 32px "Inter", "Arial", sans-serif';
  ctx.fillText(receiptLabel, targetWidth / 2, y);
  y += 44;

  ctx.font = '700 18px "Inter", "Arial", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Date: ${formatKhataDate(data.date)}`, 20, y);
  ctx.textAlign = 'right';
  if (data.customerType) {
    ctx.fillText(data.customerType.toUpperCase(), targetWidth - 20, y);
  }
  y += 26;

  // 4. Customer Info
  ctx.textAlign = 'left';
  ctx.fillText('Customer:', 20, y);
  ctx.textAlign = 'right';
  ctx.fillText((data.customerName || '').toUpperCase(), targetWidth - 20, y);
  y += 24;

  if (data.customerPhone) {
    ctx.textAlign = 'left';
    ctx.fillText('Phone:', 20, y);
    ctx.textAlign = 'right';
    ctx.fillText(data.customerPhone, targetWidth - 20, y);
    y += 24;
  }

  // 5. Divider
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(20, y);
  ctx.lineTo(targetWidth - 20, y);
  ctx.stroke();
  y += 10;

  // 6. Payment Method Banner
  ctx.textAlign = 'center';
  ctx.font = '900 24px "Inter", "Arial", sans-serif';
  const method = (data.paymentMethod || 'CASH').toUpperCase();
  ctx.fillText(`RECEIVED: ${method}`, targetWidth / 2, y);
  y += 32;

  ctx.beginPath();
  ctx.moveTo(20, y);
  ctx.lineTo(targetWidth - 20, y);
  ctx.stroke();
  y += 16;

  // 7. Statement Lines
  const drawRow = (label: string, value: string, isBig = false, isBold = true) => {
    ctx.font = isBig
      ? '900 30px "Inter", "Arial", sans-serif'
      : isBold
      ? '800 22px "Inter", "Arial", sans-serif'
      : '600 20px "Inter", "Arial", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 20, y);
    ctx.textAlign = 'right';
    ctx.fillText(value, targetWidth - 20, y);
    y += isBig ? 38 : 28;
  };

  drawRow('PREVIOUS BALANCE', `${currency} ${Math.round(data.previousBalance).toLocaleString()}`);
  drawRow('AMOUNT PAID', `${currency} ${Math.round(data.paidAmount).toLocaleString()}`, false, true);

  if (data.discountAmount && data.discountAmount > 0) {
    drawRow('DISCOUNT', `-${currency} ${Math.round(data.discountAmount).toLocaleString()}`);
  }

  y += 6;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(20, y);
  ctx.lineTo(targetWidth - 20, y);
  ctx.stroke();
  y += 12;

  // 8. Remaining Balance (Large & Prominent)
  drawRow('REMAINING BALANCE', `${currency} ${Math.round(data.remainingBalance).toLocaleString()}`, true, true);

  y += 6;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, y);
  ctx.lineTo(targetWidth - 20, y);
  ctx.stroke();
  y += 14;

  // 9. Barcode
  const barcodeText = `KHT-${String(data.receiptNo || 'PAY').slice(-8)}`;
  drawCode39(ctx, barcodeText, 20, y, targetWidth - 40, 48);
  y += 56;

  // 10. Footer Text
  ctx.font = '700 16px "Inter", "Arial", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ACCOUNT STATEMENT RECEIPT', targetWidth / 2, y);
  y += 24;

  ctx.font = '700 20px "Inter", "Arial", sans-serif';
  ctx.fillText(config?.receiptFooterText || 'Thank you for your business!', targetWidth / 2, y);
  y += 32;

  // Trim to final height + margin
  y += 16;
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetWidth;
  finalCanvas.height = y;
  const finalCtx = finalCanvas.getContext('2d');
  if (finalCtx) {
    finalCtx.drawImage(canvas, 0, 0);
  }
  return finalCanvas;
}

/**
 * Print Khata receipt directly via Tauri printer or browser print
 */
export async function printKhataReceipt(data: KhataReceiptData): Promise<void> {
  const posConfig = await posConfigService.getPOSConfig().catch(() => null);
  const widthMm = posConfig?.receiptWidth || '80mm';

  // Check if running inside Tauri
  const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);

  if (isTauri && posConfig?.printerEnabled) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const canvas = await renderKhataReceiptToCanvas(data, posConfig, widthMm);
      const bytes = canvasToEscposRaster(canvas, {
        widthMm,
        autoCutter: posConfig.autoCutter !== false,
      });

      await invoke('print_raw_bytes', {
        printerName: posConfig.printerName || '',
        data: bytes,
      });
      return;
    } catch (err) {
      console.warn('[PRINT] Tauri ESC/POS printing failed, falling back to window.print():', err);
    }
  }

  // Fallback: fast printable popup or window.print
  const printWindow = window.open('', '_blank', 'width=380,height=600');
  if (printWindow) {
    const currency = posConfig?.currencySymbol || 'Rs.';
    const shopName = posConfig?.shopName || 'GUJAR MILK SHOP';
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Khata Payment Slip</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: 'Inter', -apple-system, sans-serif;
              margin: 0;
              padding: 16px;
              width: 280px;
              color: #000;
              font-size: 13px;
            }
            .center { text-align: center; }
            .bold { font-weight: 800; }
            .divider { border-top: 1.5px solid #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 4px 0; }
            .big { font-size: 16px; font-weight: 900; }
          </style>
        </head>
        <body>
          <div class="center bold big">${shopName.toUpperCase()}</div>
          <div class="center bold">KHATA PAYMENT SLIP</div>
          <div class="divider"></div>
          <div class="row"><span>Date:</span><span>${formatKhataDate(data.date)}</span></div>
          <div class="row"><span>Customer:</span><span class="bold">${(data.customerName || '').toUpperCase()}</span></div>
          ${data.customerPhone ? `<div class="row"><span>Phone:</span><span>${data.customerPhone}</span></div>` : ''}
          <div class="divider"></div>
          <div class="center bold">RECEIVED: ${(data.paymentMethod || 'CASH').toUpperCase()}</div>
          <div class="divider"></div>
          <div class="row"><span>Previous Balance:</span><span>${currency} ${Math.round(data.previousBalance).toLocaleString()}</span></div>
          <div class="row bold"><span>Amount Paid:</span><span>${currency} ${Math.round(data.paidAmount).toLocaleString()}</span></div>
          ${data.discountAmount && data.discountAmount > 0 ? `<div class="row"><span>Discount:</span><span>-${currency} ${Math.round(data.discountAmount).toLocaleString()}</span></div>` : ''}
          <div class="divider"></div>
          <div class="row big"><span>Remaining:</span><span>${currency} ${Math.round(data.remainingBalance).toLocaleString()}</span></div>
          <div class="divider"></div>
          <div class="center" style="margin-top: 10px; font-size: 11px;">${posConfig?.receiptFooterText || 'Thank you for your business!'}</div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
}

