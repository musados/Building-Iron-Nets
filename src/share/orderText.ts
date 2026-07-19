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
  if ((order.barLines?.length ?? 0) > 0) {
    lines.push('');
    lines.push(`${strings.barLinesTitle}:`);
    for (const line of order.barLines!) {
      lines.push(
        `• מוט Ø${line.diameterMm} מ"מ × ${line.lengthM} מ' — ` +
          `${line.quantity} ${strings.units} (${line.totalWeightKg.toFixed(0)} ק"ג)`
      );
    }
  }

  if ((order.columns?.length ?? 0) > 0) {
    lines.push('');
    lines.push(`${strings.columnsBreakdown}:`);
    for (const col of order.columns!) {
      const r = order.columnResults?.find((res) => res.columnId === col.id);
      if (!r) continue;
      lines.push(
        `• ${col.name} × ${col.count} (${col.widthCm}/${col.depthCm} ס"מ, גובה ${col.heightM} מ'):`
      );
      lines.push(
        `   ${strings.longBars}: ${r.longBarsTotal} × Ø${col.longBarDiameterMm} ` +
          `באורך ${r.longBarLengthM} מ' (${r.longBarsWeightKg.toFixed(0)} ק"ג)`
      );
      lines.push(
        `   ${strings.stirrups}: ${r.stirrupsTotal} × Ø${col.stirrupDiameterMm} ` +
          `@ ${col.stirrupSpacingCm} ס"מ, אורך חיתוך ${r.stirrupLengthM.toFixed(2)} מ' ` +
          `(${r.stirrupsWeightKg.toFixed(0)} ק"ג)`
      );
    }
  }

  lines.push('');
  const totalSheets = order.lines.reduce((s, l) => s + l.quantity, 0);
  const totalBars = (order.barLines ?? []).reduce((s, l) => s + l.quantity, 0);
  const totalColumns = (order.columns ?? []).reduce((s, c) => s + c.count, 0);
  lines.push(`${strings.grandTotalSheets}: ${totalSheets}`);
  if (totalBars > 0) lines.push(`${strings.grandTotalBars}: ${totalBars}`);
  if (totalColumns > 0) {
    lines.push(`${strings.grandTotalColumns}: ${totalColumns}`);
  }
  lines.push(`${strings.grandTotalWeight}: ${order.totalWeightKg.toFixed(0)} ק"ג`);

  if (order.areas.length > 0) {
    lines.push('');
    lines.push(`${strings.areasBreakdown}:`);
    for (const area of order.areas) {
      const result = order.results.find((r) => r.areaId === area.id);
      if (!result) continue;
      const areaOverlap =
        area.overlapCm != null
          ? ` · ${strings.overlap} ${area.overlapCm} ס"מ`
          : '';
      lines.push(
        `• ${area.name}: ${area.lengthM}×${area.widthM} מ' · ` +
          `רשת ${area.mesh.sheetWidthM}×${area.mesh.sheetLengthM} ` +
          `Ø${area.mesh.wireDiameterMm}@${area.mesh.spacingCm}${areaOverlap} → ` +
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
