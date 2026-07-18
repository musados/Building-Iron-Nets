export interface MeshSpec {
  sheetLengthM: number;
  sheetWidthM: number;
  wireDiameterMm: number;
  spacingCm: number;
  isCustomSize: boolean;
}

export interface RectArea {
  id: string;
  name: string;
  lengthM: number;
  widthM: number;
  mesh: MeshSpec;
}

export type Orientation = 'as-is' | 'rotated';

export interface AreaResult {
  areaId: string;
  orientation: Orientation;
  countAlongLength: number;
  countAlongWidth: number;
  sheetCount: number;
  areaSqm: number;
  purchasedSqm: number;
  wastePct: number;
}

export interface OrderLine {
  mesh: MeshSpec;
  quantity: number;
  unitWeightKg: number;
  totalWeightKg: number;
}

export interface Order {
  id: string;
  createdAt: string;
  title: string;
  overlapCm: number;
  areas: RectArea[];
  results: AreaResult[];
  lines: OrderLine[];
  totalWeightKg: number;
  notes?: string;
}

export interface OrderSummary {
  id: string;
  title: string;
  createdAt: string;
  totalSheets: number;
  totalWeightKg: number;
}
