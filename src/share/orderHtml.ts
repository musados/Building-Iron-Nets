import { Order } from '../types';
import { strings } from '../i18n/strings';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function orderToHtml(order: Order): string {
  const totalSheets = order.lines.reduce((s, l) => s + l.quantity, 0);

  const lineRows = order.lines
    .map((line) => {
      const m = line.mesh;
      return `<tr>
        <td>${esc(strings.meshLine(m.sheetLengthM, m.sheetWidthM, m.wireDiameterMm, m.spacingCm))}</td>
        <td>${line.quantity}</td>
        <td>${line.unitWeightKg.toFixed(1)}</td>
        <td>${line.totalWeightKg.toFixed(0)}</td>
      </tr>`;
    })
    .join('\n');

  const areaRows = order.areas
    .map((area) => {
      const r = order.results.find((res) => res.areaId === area.id);
      if (!r) return '';
      const orientation =
        r.orientation === 'rotated'
          ? strings.orientationRotated
          : strings.orientationAsIs;
      return `<tr>
        <td>${esc(area.name)}</td>
        <td>${area.lengthM}×${area.widthM}</td>
        <td>${r.countAlongLength}×${r.countAlongWidth} (${orientation})</td>
        <td>${r.sheetCount}</td>
        <td>${r.wastePct.toFixed(0)}%</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; margin: 32px; color: #1a1a1a; }
  h1 { font-size: 22px; margin-bottom: 2px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 20px; }
  h2 { font-size: 16px; margin-top: 24px; border-bottom: 2px solid #b45309; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: right; }
  th { background: #f5f0e8; }
  .totals { margin-top: 16px; font-size: 15px; font-weight: bold; }
  .notes { margin-top: 16px; font-size: 13px; white-space: pre-wrap; }
</style>
</head>
<body>
  <h1>${esc(strings.docTitle)}${order.title ? ' — ' + esc(order.title) : ''}</h1>
  <div class="meta">
    ${esc(strings.createdAt)}: ${fmtDate(order.createdAt)} ·
    ${esc(strings.overlap)}: ${order.overlapCm} ס"מ
  </div>

  <h2>${esc(strings.orderLines)}</h2>
  <table>
    <tr>
      <th>מפרט</th>
      <th>${esc(strings.quantity)}</th>
      <th>${esc(strings.unitWeight)} (ק"ג)</th>
      <th>${esc(strings.totalWeight)} (ק"ג)</th>
    </tr>
    ${lineRows}
  </table>

  ${
    (order.barLines?.length ?? 0) > 0
      ? `<h2>${esc(strings.barLinesTitle)}</h2>
  <table>
    <tr>
      <th>מפרט</th>
      <th>${esc(strings.quantity)}</th>
      <th>${esc(strings.unitWeight)} (ק"ג)</th>
      <th>${esc(strings.totalWeight)} (ק"ג)</th>
    </tr>
    ${order
      .barLines!.map(
        (line) => `<tr>
      <td>מוט Ø${line.diameterMm} מ"מ × ${line.lengthM} מ'</td>
      <td>${line.quantity}</td>
      <td>${line.unitWeightKg.toFixed(1)}</td>
      <td>${line.totalWeightKg.toFixed(0)}</td>
    </tr>`
      )
      .join('\n')}
  </table>`
      : ''
  }

  ${
    (order.columns?.length ?? 0) > 0
      ? `<h2>${esc(strings.columnsBreakdown)}</h2>
  <table>
    <tr>
      <th>שם</th>
      <th>כמות</th>
      <th>חתך (ס"מ)</th>
      <th>גובה (מ')</th>
      <th>${esc(strings.longBars)}</th>
      <th>${esc(strings.stirrups)}</th>
      <th>${esc(strings.totalWeight)} (ק"ג)</th>
    </tr>
    ${order
      .columns!.map((col) => {
        const r = order.columnResults?.find((res) => res.columnId === col.id);
        if (!r) return '';
        return `<tr>
      <td>${esc(col.name)}</td>
      <td>${col.count}</td>
      <td>${col.widthCm}/${col.depthCm}</td>
      <td>${col.heightM}</td>
      <td>${r.longBarsTotal} × Ø${col.longBarDiameterMm} @ ${r.longBarLengthM} מ'</td>
      <td>${r.stirrupsTotal} × Ø${col.stirrupDiameterMm}, ${r.stirrupLengthM.toFixed(2)} מ'</td>
      <td>${r.totalWeightKg.toFixed(0)}</td>
    </tr>`;
      })
      .join('\n')}
  </table>`
      : ''
  }

  <h2>${esc(strings.areasBreakdown)}</h2>
  <table>
    <tr>
      <th>שם</th>
      <th>מידות (מ')</th>
      <th>${esc(strings.layout)}</th>
      <th>רשתות</th>
      <th>${esc(strings.waste)}</th>
    </tr>
    ${areaRows}
  </table>

  <div class="totals">
    ${esc(strings.grandTotalSheets)}: ${totalSheets} ·
    ${esc(strings.grandTotalWeight)}: ${order.totalWeightKg.toFixed(0)} ק"ג
  </div>
  ${order.notes ? `<div class="notes">${esc(order.notes)}</div>` : ''}
</body>
</html>`;
}
