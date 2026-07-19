import {
  AreaResult,
  MeshSpec,
  OrderLine,
  Orientation,
  RectArea,
} from '../types';

export class CalcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalcError';
  }
}

const EPSILON = 1e-9;

/** משקל מוט בק"ג למטר אורך לפי קוטר במ"מ */
export function barWeightKgPerM(wireDiameterMm: number): number {
  if (wireDiameterMm <= 0) {
    throw new CalcError('קוטר ברזל חייב להיות גדול מאפס');
  }
  return 0.006165 * wireDiameterMm * wireDiameterMm;
}

/** משקל רשת בק"ג למ"ר: שני כיוונים, מוטות לפי מרווח */
export function meshWeightPerSqm(
  wireDiameterMm: number,
  spacingCm: number
): number {
  if (spacingCm <= 0) {
    throw new CalcError('מרווח עיניים חייב להיות גדול מאפס');
  }
  return barWeightKgPerM(wireDiameterMm) * 2 * (100 / spacingCm);
}

export function sheetWeightKg(spec: MeshSpec): number {
  return (
    meshWeightPerSqm(spec.wireDiameterMm, spec.spacingCm) *
    spec.sheetLengthM *
    spec.sheetWidthM
  );
}

/**
 * מספר רשתות לאורך ציר אחד, בהתחשב בחפייה.
 * אם המפתח קטן/שווה למידת הרשת — רשת אחת מספיקה והחפייה לא רלוונטית.
 */
export function sheetsAlongAxis(
  spanM: number,
  sheetDimM: number,
  overlapM: number
): number {
  if (spanM <= 0) {
    throw new CalcError('מידת שטח חייבת להיות גדולה מאפס');
  }
  if (sheetDimM <= 0) {
    throw new CalcError('מידת רשת חייבת להיות גדולה מאפס');
  }
  if (overlapM < 0) {
    throw new CalcError('חפייה לא יכולה להיות שלילית');
  }
  if (spanM <= sheetDimM + EPSILON) {
    return 1;
  }
  if (sheetDimM <= overlapM + EPSILON) {
    throw new CalcError('החפייה גדולה או שווה למידת הרשת');
  }
  return Math.ceil((spanM - overlapM) / (sheetDimM - overlapM) - EPSILON);
}

interface OrientationResult {
  orientation: Orientation;
  countAlongLength: number;
  countAlongWidth: number;
  sheetCount: number;
}

function tryOrientation(
  rect: { lengthM: number; widthM: number },
  dimAlongLengthM: number,
  dimAlongWidthM: number,
  overlapM: number,
  orientation: Orientation
): OrientationResult | null {
  try {
    const countAlongLength = sheetsAlongAxis(
      rect.lengthM,
      dimAlongLengthM,
      overlapM
    );
    const countAlongWidth = sheetsAlongAxis(
      rect.widthM,
      dimAlongWidthM,
      overlapM
    );
    return {
      orientation,
      countAlongLength,
      countAlongWidth,
      sheetCount: countAlongLength * countAlongWidth,
    };
  } catch (e) {
    if (e instanceof CalcError) return null;
    throw e;
  }
}

/**
 * כיסוי מלבן ברשתות: בודק את שני כיווני ההנחה ובוחר את זה שדורש
 * פחות רשתות (בשוויון — פחות פחת). זורק CalcError רק אם שני הכיוונים
 * לא אפשריים (למשל חפייה גדולה ממידות הרשת).
 */
export function coverRect(area: RectArea, overlapCm: number): AreaResult {
  if (overlapCm < 0) {
    throw new CalcError('חפייה לא יכולה להיות שלילית');
  }
  if (area.lengthM <= 0 || area.widthM <= 0) {
    throw new CalcError('מידות שטח חייבות להיות גדולות מאפס');
  }
  const overlapM = overlapCm / 100;
  const { sheetLengthM, sheetWidthM } = area.mesh;

  const candidates = [
    tryOrientation(area, sheetLengthM, sheetWidthM, overlapM, 'as-is'),
    tryOrientation(area, sheetWidthM, sheetLengthM, overlapM, 'rotated'),
  ].filter((c): c is OrientationResult => c !== null);

  if (candidates.length === 0) {
    throw new CalcError('החפייה גדולה ממידות הרשת — לא ניתן לחשב');
  }

  candidates.sort((a, b) => a.sheetCount - b.sheetCount);
  const best = candidates[0];

  const areaSqm = area.lengthM * area.widthM;
  const purchasedSqm = best.sheetCount * sheetLengthM * sheetWidthM;

  return {
    areaId: area.id,
    orientation: best.orientation,
    countAlongLength: best.countAlongLength,
    countAlongWidth: best.countAlongWidth,
    sheetCount: best.sheetCount,
    areaSqm,
    purchasedSqm,
    wastePct: ((purchasedSqm - areaSqm) / areaSqm) * 100,
  };
}

function meshKey(mesh: MeshSpec): string {
  return `${mesh.sheetLengthM}x${mesh.sheetWidthM}|d${mesh.wireDiameterMm}|s${mesh.spacingCm}`;
}

export interface OrderComputation {
  results: AreaResult[];
  lines: OrderLine[];
  totalWeightKg: number;
}

/**
 * חישוב הזמנה שלמה: תוצאה לכל שטח, קיבוץ שורות לפי מפרט רשת זהה,
 * ומשקל כולל. overlapCm הוא ברירת המחדל — שטח יכול להגדיר חפייה משלו.
 */
export function computeOrder(
  areas: RectArea[],
  overlapCm: number
): OrderComputation {
  const results: AreaResult[] = [];
  const lineMap = new Map<string, OrderLine>();

  for (const area of areas) {
    const result = coverRect(area, area.overlapCm ?? overlapCm);
    results.push(result);

    const key = meshKey(area.mesh);
    const existing = lineMap.get(key);
    if (existing) {
      existing.quantity += result.sheetCount;
      existing.totalWeightKg = existing.quantity * existing.unitWeightKg;
    } else {
      const unitWeightKg = sheetWeightKg(area.mesh);
      lineMap.set(key, {
        mesh: { ...area.mesh },
        quantity: result.sheetCount,
        unitWeightKg,
        totalWeightKg: result.sheetCount * unitWeightKg,
      });
    }
  }

  const lines = [...lineMap.values()];
  const totalWeightKg = lines.reduce((sum, l) => sum + l.totalWeightKg, 0);

  return { results, lines, totalWeightKg };
}
