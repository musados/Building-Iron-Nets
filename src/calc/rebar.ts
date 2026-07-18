import {
  BarItem,
  BarLine,
  ColumnItem,
  ColumnResult,
} from '../types';
import { barWeightKgPerM, CalcError } from './mesh';

/** משקל פריט מוטות: קוטר × אורך × כמות */
export function barItemWeightKg(bar: BarItem): number {
  if (bar.lengthM <= 0 || bar.quantity <= 0) {
    throw new CalcError('אורך וכמות מוטות חייבים להיות גדולים מאפס');
  }
  return barWeightKgPerM(bar.diameterMm) * bar.lengthM * bar.quantity;
}

/** קיבוץ מוטות לשורות הזמנה לפי קוטר ואורך */
export function groupBars(bars: BarItem[]): BarLine[] {
  const map = new Map<string, BarLine>();
  for (const bar of bars) {
    const key = `d${bar.diameterMm}|l${bar.lengthM}`;
    const unitWeightKg = barWeightKgPerM(bar.diameterMm) * bar.lengthM;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += bar.quantity;
      existing.totalWeightKg = existing.quantity * existing.unitWeightKg;
    } else {
      map.set(key, {
        diameterMm: bar.diameterMm,
        lengthM: bar.lengthM,
        quantity: bar.quantity,
        unitWeightKg,
        totalWeightKg: unitWeightKg * bar.quantity,
      });
    }
  }
  return [...map.values()].sort(
    (a, b) => a.diameterMm - b.diameterMm || a.lengthM - b.lengthM
  );
}

/**
 * חישוב זיון לעמוד:
 * - מוטות אורכיים: אורך חיתוך = גובה העמוד.
 * - חישוק: היקף החתך פחות כיסוי משני הצדדים, בתוספת שני ווים של 10 קטרים.
 * - מספר חישוקים: גובה חלקי מרווח, ועוד אחד.
 */
export function computeColumn(col: ColumnItem): ColumnResult {
  if (col.count <= 0) {
    throw new CalcError('כמות עמודים חייבת להיות גדולה מאפס');
  }
  if (col.widthCm <= 0 || col.depthCm <= 0 || col.heightM <= 0) {
    throw new CalcError('מידות עמוד חייבות להיות גדולות מאפס');
  }
  if (col.coverCm < 0) {
    throw new CalcError('כיסוי בטון לא יכול להיות שלילי');
  }
  if (
    2 * col.coverCm >= col.widthCm ||
    2 * col.coverCm >= col.depthCm
  ) {
    throw new CalcError('הכיסוי גדול מדי ביחס למידות החתך');
  }
  if (col.longBarCount <= 0 || col.stirrupSpacingCm <= 0) {
    throw new CalcError('נתוני זיון עמוד לא תקינים');
  }

  const longBarLengthM = col.heightM;
  const longBarsTotal = col.longBarCount * col.count;
  const longBarsWeightKg =
    barWeightKgPerM(col.longBarDiameterMm) * longBarLengthM * longBarsTotal;

  const innerWm = (col.widthCm - 2 * col.coverCm) / 100;
  const innerDm = (col.depthCm - 2 * col.coverCm) / 100;
  const hookM = (2 * 10 * col.stirrupDiameterMm) / 1000;
  const stirrupLengthM = 2 * (innerWm + innerDm) + hookM;

  const stirrupsPerColumn =
    Math.floor(col.heightM / (col.stirrupSpacingCm / 100)) + 1;
  const stirrupsTotal = stirrupsPerColumn * col.count;
  const stirrupsWeightKg =
    barWeightKgPerM(col.stirrupDiameterMm) * stirrupLengthM * stirrupsTotal;

  return {
    columnId: col.id,
    longBarLengthM,
    longBarsTotal,
    longBarsWeightKg,
    stirrupLengthM,
    stirrupsPerColumn,
    stirrupsTotal,
    stirrupsWeightKg,
    totalWeightKg: longBarsWeightKg + stirrupsWeightKg,
  };
}

export interface PlanExtras {
  barLines: BarLine[];
  columnResults: ColumnResult[];
  totalWeightKg: number;
}

/** חישוב תוספות הזמנה לפי תוכנית: מוטות בודדים ועמודים */
export function computePlanExtras(
  bars: BarItem[],
  columns: ColumnItem[]
): PlanExtras {
  const barLines = groupBars(bars);
  const columnResults = columns.map(computeColumn);
  const totalWeightKg =
    barLines.reduce((s, l) => s + l.totalWeightKg, 0) +
    columnResults.reduce((s, c) => s + c.totalWeightKg, 0);
  return { barLines, columnResults, totalWeightKg };
}
