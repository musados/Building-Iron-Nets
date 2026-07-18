import { CalcError } from './mesh';
import {
  barItemWeightKg,
  computeColumn,
  computePlanExtras,
  groupBars,
} from './rebar';
import { BarItem, ColumnItem } from '../types';

function bar(overrides: Partial<BarItem> = {}): BarItem {
  return { id: 'b1', diameterMm: 12, lengthM: 12, quantity: 10, ...overrides };
}

function column(overrides: Partial<ColumnItem> = {}): ColumnItem {
  return {
    id: 'c1',
    name: 'עמוד',
    count: 4,
    widthCm: 30,
    depthCm: 30,
    heightM: 3,
    coverCm: 3,
    longBarCount: 4,
    longBarDiameterMm: 16,
    stirrupDiameterMm: 8,
    stirrupSpacingCm: 20,
    ...overrides,
  };
}

describe('barItemWeightKg', () => {
  test('12mm bar weighs about 0.888 kg/m', () => {
    // 0.006165 × 144 = 0.88776 kg/m × 12m × 10 = 106.5 kg
    expect(barItemWeightKg(bar())).toBeCloseTo(106.5, 0);
  });

  test('zero quantity throws', () => {
    expect(() => barItemWeightKg(bar({ quantity: 0 }))).toThrow(CalcError);
  });
});

describe('groupBars', () => {
  test('groups by diameter and length', () => {
    const lines = groupBars([
      bar({ id: 'a', quantity: 10 }),
      bar({ id: 'b', quantity: 5 }),
      bar({ id: 'c', diameterMm: 8, quantity: 20 }),
    ]);
    expect(lines).toHaveLength(2);
    const line12 = lines.find((l) => l.diameterMm === 12)!;
    expect(line12.quantity).toBe(15);
    expect(line12.totalWeightKg).toBeCloseTo(15 * line12.unitWeightKg);
  });

  test('sorted by diameter then length', () => {
    const lines = groupBars([
      bar({ diameterMm: 16 }),
      bar({ diameterMm: 8 }),
      bar({ diameterMm: 8, lengthM: 6 }),
    ]);
    expect(lines.map((l) => [l.diameterMm, l.lengthM])).toEqual([
      [8, 6],
      [8, 12],
      [16, 12],
    ]);
  });
});

describe('computeColumn', () => {
  test('computes bars, stirrups and weight for a standard column', () => {
    const r = computeColumn(column());
    // long bars: 4 bars × 4 columns × 3m of Ø16 (1.578 kg/m) ≈ 75.8 kg
    expect(r.longBarsTotal).toBe(16);
    expect(r.longBarLengthM).toBe(3);
    expect(r.longBarsWeightKg).toBeCloseTo(16 * 3 * 0.006165 * 256, 1);
    // stirrup: inner 24×24cm → 2×(0.24+0.24) + 2×10×8mm = 0.96 + 0.16 = 1.12m
    expect(r.stirrupLengthM).toBeCloseTo(1.12);
    // floor(3 / 0.2) + 1 = 16 per column × 4 = 64
    expect(r.stirrupsPerColumn).toBe(16);
    expect(r.stirrupsTotal).toBe(64);
    expect(r.totalWeightKg).toBeCloseTo(
      r.longBarsWeightKg + r.stirrupsWeightKg
    );
  });

  test('cover too large throws', () => {
    expect(() => computeColumn(column({ coverCm: 15 }))).toThrow(CalcError);
  });

  test('zero height throws', () => {
    expect(() => computeColumn(column({ heightM: 0 }))).toThrow(CalcError);
  });
});

describe('computePlanExtras', () => {
  test('sums bar lines and columns', () => {
    const { barLines, columnResults, totalWeightKg } = computePlanExtras(
      [bar()],
      [column()]
    );
    expect(barLines).toHaveLength(1);
    expect(columnResults).toHaveLength(1);
    expect(totalWeightKg).toBeCloseTo(
      barLines[0].totalWeightKg + columnResults[0].totalWeightKg
    );
  });

  test('empty inputs compute to zero', () => {
    const { barLines, columnResults, totalWeightKg } = computePlanExtras([], []);
    expect(barLines).toHaveLength(0);
    expect(columnResults).toHaveLength(0);
    expect(totalWeightKg).toBe(0);
  });
});
