import { Order } from '../types';
import { strings } from '../i18n/strings';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

export function orderToText(order: Order): string {
  const lines: string[] = [];
  lines.push(`${strings.docTitle} — ${order.title || ''}`.trim());
  lines.push(`${strings.createdAt}: ${fmtDate(order.createdAt)}`);
  lines.push(`${strings.overlap}: ${order.overlapCm} ס"מ`);
  lines.push('');
  lines.push(`${strings.orderLines}:`);
  for (const line of order.lines) {
    const m = line.mesh;
    lines.push(
      `• ${strings.meshLine(m.sheetLengthM, m.sheetWidthM, m.wireDiameterMm, m.spacingCm)} — ` +
        `${line.quantity} ${strings.units} (${line.totalWeightKg.toFixed(0)} ק"ג)`
    );
  }
  lines.push('');
  const totalSheets = order.lines.reduce((s, l) => s + l.quantity, 0);
  lines.push(`${strings.grandTotalSheets}: ${totalSheets}`);
  lines.push(`${strings.grandTotalWeight}: ${order.totalWeightKg.toFixed(0)} ק"ג`);

  if (order.areas.length > 0) {
    lines.push('');
    lines.push(`${strings.areasBreakdown}:`);
    for (const area of order.areas) {
      const result = order.results.find((r) => r.areaId === area.id);
      if (!result) continue;
      lines.push(
        `• ${area.name}: ${area.lengthM}×${area.widthM} מ' → ` +
          `${result.sheetCount} רשתות (${result.countAlongLength}×${result.countAlongWidth})`
      );
    }
  }

  if (order.notes) {
    lines.push('');
    lines.push(order.notes);
  }

  return lines.join('\n');
}
