import {
  CalcError,
  computeOrder,
  coverRect,
  meshWeightPerSqm,
  sheetWeightKg,
  sheetsAlongAxis,
} from './mesh';
import { MeshSpec, RectArea } from '../types';

function mesh(overrides: Partial<MeshSpec> = {}): MeshSpec {
  return {
    sheetLengthM: 3,
    sheetWidthM: 2,
    wireDiameterMm: 8,
    spacingCm: 20,
    isCustomSize: false,
    ...overrides,
  };
}

function area(
  lengthM: number,
  widthM: number,
  meshOverrides: Partial<MeshSpec> = {},
  id = 'a1'
): RectArea {
  return { id, name: 'שטח', lengthM, widthM, mesh: mesh(meshOverrides) };
}

describe('sheetsAlongAxis', () => {
  test('span smaller than sheet needs one sheet', () => {
    expect(sheetsAlongAxis(2.5, 3, 0.3)).toBe(1);
  });

  test('exact fit needs one sheet regardless of overlap', () => {
    expect(sheetsAlongAxis(3, 3, 0.3)).toBe(1);
  });

  test('span just over sheet needs two sheets', () => {
    // ceil((3.05 - 0.25) / (3 - 0.25)) = ceil(1.018) = 2
    expect(sheetsAlongAxis(3.05, 3, 0.25)).toBe(2);
  });

  test('exact multiple is not inflated by floating point', () => {
    // (4.75 - 0.25) / (2.5 - 0.25) = 2 exactly
    expect(sheetsAlongAxis(4.75, 2.5, 0.25)).toBe(2);
  });

  test('overlap >= sheet dimension throws when more than one sheet needed', () => {
    expect(() => sheetsAlongAxis(5, 2, 2)).toThrow(CalcError);
  });

  test('zero or negative span throws', () => {
    expect(() => sheetsAlongAxis(0, 3, 0.3)).toThrow(CalcError);
    expect(() => sheetsAlongAxis(-1, 3, 0.3)).toThrow(CalcError);
  });
});

describe('coverRect', () => {
  test('exact fit: one sheet, zero waste', () => {
    const r = coverRect(area(3, 2), 30);
    expect(r.sheetCount).toBe(1);
    expect(r.wastePct).toBeCloseTo(0);
  });

  test('picks the orientation with fewer sheets', () => {
    // rect 6×4, sheet 3×2, overlap 25cm:
    // as-is: ceil(5.75/2.75)=3 × ceil(3.75/1.75)=3 → 9
    // rotated: ceil(5.75/1.75)=4 × ceil(3.75/2.75)=2 → 8
    const r = coverRect(area(6, 4), 25);
    expect(r.sheetCount).toBe(8);
    expect(r.orientation).toBe('rotated');
    expect(r.countAlongLength).toBe(4);
    expect(r.countAlongWidth).toBe(2);
  });

  test('waste percentage reflects purchased vs covered area', () => {
    const r = coverRect(area(6, 4), 25);
    // 8 sheets × 6 m² = 48 m² purchased for 24 m² area → 100% waste
    expect(r.purchasedSqm).toBeCloseTo(48);
    expect(r.wastePct).toBeCloseTo(100);
  });

  test('solvable via the other orientation when one is invalid', () => {
    // overlap 200cm: rotated puts sheet width 2 ≤ 2 along length 5 → invalid,
    // as-is: ceil((5-2)/(3-2))=3 along length, width 1.5 fits one sheet
    const r = coverRect(area(5, 1.5), 200);
    expect(r.sheetCount).toBe(3);
    expect(r.orientation).toBe('as-is');
  });

  test('throws when both orientations are invalid', () => {
    expect(() => coverRect(area(5, 4), 300)).toThrow(CalcError);
  });

  test('zero dimension throws', () => {
    expect(() => coverRect(area(0, 4), 30)).toThrow(CalcError);
  });
});

describe('weight', () => {
  test('8mm @ 15/15 is about 5.26 kg/m²', () => {
    expect(meshWeightPerSqm(8, 15)).toBeCloseTo(5.26, 1);
  });

  test('8mm @ 15/15 sheet 3×2 is about 31.6 kg', () => {
    expect(sheetWeightKg(mesh({ spacingCm: 15 }))).toBeCloseTo(31.6, 0);
  });

  test('5.5mm @ 20/20 sheet 3×2 is about 11.2 kg', () => {
    expect(sheetWeightKg(mesh({ wireDiameterMm: 5.5 }))).toBeCloseTo(11.2, 1);
  });
});

describe('computeOrder', () => {
  test('groups identical mesh specs into one line', () => {
    const areas = [
      area(6, 4, {}, 'a1'),
      area(3, 2, {}, 'a2'),
      area(3, 2, { wireDiameterMm: 10 }, 'a3'),
    ];
    const { results, lines, totalWeightKg } = computeOrder(areas, 25);

    expect(results).toHaveLength(3);
    expect(lines).toHaveLength(2);

    const line8 = lines.find((l) => l.mesh.wireDiameterMm === 8)!;
    expect(line8.quantity).toBe(8 + 1);
    expect(line8.totalWeightKg).toBeCloseTo(9 * line8.unitWeightKg);

    const line10 = lines.find((l) => l.mesh.wireDiameterMm === 10)!;
    expect(line10.quantity).toBe(1);

    expect(totalWeightKg).toBeCloseTo(
      line8.totalWeightKg + line10.totalWeightKg
    );
  });

  test('area-level overlap overrides the order overlap', () => {
    // rect 6×4 sheet 3×2: with overlap 25 → 8 sheets; area override 0 → 2×2=4
    const withDefault = computeOrder([area(6, 4, {}, 'a1')], 25);
    const overridden = computeOrder(
      [{ ...area(6, 4, {}, 'a1'), overlapCm: 0 }],
      25
    );
    expect(withDefault.results[0].sheetCount).toBe(8);
    expect(overridden.results[0].sheetCount).toBe(4);
  });

  test('empty order computes to zero', () => {
    const { results, lines, totalWeightKg } = computeOrder([], 30);
    expect(results).toHaveLength(0);
    expect(lines).toHaveLength(0);
    expect(totalWeightKg).toBe(0);
  });
});
