import { AiExtractionReport, AiReportItem } from '../types';
import { strings } from '../i18n/strings';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function section(title: string, items: AiReportItem[]): string {
  if (items.length === 0) return '';
  const rows = items
    .map(
      (item) => `<div class="item">
    <div class="label">${esc(item.label)}</div>
    <div class="derivation">${esc(item.derivation)}</div>
  </div>`
    )
    .join('\n');
  return `<h2>${esc(title)}</h2>\n${rows}`;
}

export function extractionReportToHtml(
  report: AiExtractionReport,
  orderTitle: string
): string {
  const d = new Date(report.extractedAt);
  const dateText = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; margin: 32px; color: #1a1a1a; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 16px; }
  .disclaimer { background: #fdf3e3; border: 1px solid #e5c88f; border-radius: 8px;
                padding: 10px 12px; font-size: 13px; margin-bottom: 18px; }
  h2 { font-size: 16px; margin-top: 22px; border-bottom: 2px solid #3273b8; padding-bottom: 4px; }
  .item { border: 1px solid #e0d8cc; border-radius: 8px; padding: 10px 12px; margin-top: 10px;
          page-break-inside: avoid; }
  .label { font-weight: bold; font-size: 14px; margin-bottom: 6px; }
  .derivation { font-size: 13px; color: #333; white-space: pre-wrap; }
  .notes { margin-top: 20px; font-size: 13px; white-space: pre-wrap;
           background: #f7f4ef; border-radius: 8px; padding: 12px; }
</style>
</head>
<body>
  <h1>${esc(strings.aiReportTitle)}${orderTitle ? ' — ' + esc(orderTitle) : ''}</h1>
  <div class="meta">${esc(strings.createdAt)}: ${dateText}</div>
  <div class="disclaimer">${esc(strings.aiReportDisclaimer)}</div>
  ${section(strings.areasBreakdown, report.meshes)}
  ${section(strings.barLinesTitle, report.bars)}
  ${section(strings.columnsBreakdown, report.columns)}
  ${
    report.notes
      ? `<h2>${esc(strings.aiReportNotes)}</h2><div class="notes">${esc(report.notes)}</div>`
      : ''
  }
</body>
</html>`;
}
