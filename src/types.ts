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

export type OrderType = 'simple' | 'plan';

/** מוט בודד: קוטר, אורך חיתוך וכמות */
export interface BarItem {
  id: string;
  diameterMm: number;
  lengthM: number;
  quantity: number;
}

/** שורת מוטות מקובצת לפי קוטר ואורך */
export interface BarLine {
  diameterMm: number;
  lengthM: number;
  quantity: number;
  unitWeightKg: number;
  totalWeightKg: number;
}

/** עמוד: מידות חתך, גובה, זיון אורכי וחישוקים */
export interface ColumnItem {
  id: string;
  name: string;
  count: number;
  widthCm: number;
  depthCm: number;
  heightM: number;
  coverCm: number;
  longBarCount: number;
  longBarDiameterMm: number;
  stirrupDiameterMm: number;
  stirrupSpacingCm: number;
}

export interface ColumnResult {
  columnId: string;
  longBarLengthM: number;
  longBarsTotal: number;
  longBarsWeightKg: number;
  stirrupLengthM: number;
  stirrupsPerColumn: number;
  stirrupsTotal: number;
  stirrupsWeightKg: number;
  totalWeightKg: number;
}

/** פריט בדוח ההסברים של חילוץ ה-AI: מה נמצא ואיך המודל חישב */
export interface AiReportItem {
  label: string;
  derivation: string;
}

export interface AiExtractionReport {
  extractedAt: string;
  meshes: AiReportItem[];
  bars: AiReportItem[];
  columns: AiReportItem[];
  notes: string;
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
  orderType?: OrderType;
  bars?: BarItem[];
  barLines?: BarLine[];
  columns?: ColumnItem[];
  columnResults?: ColumnResult[];
  planFileName?: string;
  planFileUri?: string;
  aiExtraction?: AiExtractionReport;
}

export interface OrderSummary {
  id: string;
  title: string;
  createdAt: string;
  totalSheets: number;
  totalWeightKg: number;
}
