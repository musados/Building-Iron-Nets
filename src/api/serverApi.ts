/**
 * לקוח לשרת ה-FastAPI: חילוץ כמויות מ-PDF ופרסור DXF.
 * הצורות (types) חייבות להתאים לסכמות בצד השרת (server/main.py).
 */

export interface ExtractedMesh {
  name: string;
  lengthM: number;
  widthM: number;
}

export interface ExtractedBar {
  diameterMm: number;
  lengthM: number;
  quantity: number;
}

export interface ExtractedColumn {
  name: string;
  count: number;
  widthCm: number;
  depthCm: number;
  heightM: number;
  longBarCount: number;
  longBarDiameterMm: number;
  stirrupDiameterMm: number;
  stirrupSpacingCm: number;
}

export interface ExtractionResult {
  meshes: ExtractedMesh[];
  bars: ExtractedBar[];
  columns: ExtractedColumn[];
  notes: string;
}

export interface DxfLayerInfo {
  name: string;
  entityCount: number;
  totalLengthM: number;
}

export interface DxfParseResult {
  layers: DxfLayerInfo[];
  texts: string[];
}

function normalizeBaseUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, '');
}

async function uploadFile<T>(
  serverUrl: string,
  path: string,
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<T> {
  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  const response = await fetch(`${normalizeBaseUrl(serverUrl)}${path}`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`שגיאת שרת (${response.status}): ${text.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

export async function checkHealth(serverUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${normalizeBaseUrl(serverUrl)}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export function extractFromPdf(
  serverUrl: string,
  fileUri: string,
  fileName: string
): Promise<ExtractionResult> {
  return uploadFile<ExtractionResult>(
    serverUrl,
    '/extract-pdf',
    fileUri,
    fileName,
    'application/pdf'
  );
}

export function parseDxf(
  serverUrl: string,
  fileUri: string,
  fileName: string
): Promise<DxfParseResult> {
  return uploadFile<DxfParseResult>(
    serverUrl,
    '/parse-dxf',
    fileUri,
    fileName,
    'application/octet-stream'
  );
}
