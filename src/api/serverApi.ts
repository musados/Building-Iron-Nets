/**
 * לקוח לשרת ה-FastAPI: חילוץ כמויות מ-PDF, המרת DWG/DXF ופרסור DXF.
 * הצורות (types) חייבות להתאים לסכמות בצד השרת (server/main.py).
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

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

async function buildForm(
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    // בדפדפן ה-URI הוא blob: — צריך Blob אמיתי, לא אובייקט {uri} של RN
    const blob = await (await fetch(fileUri)).blob();
    form.append('file', new File([blob], fileName, { type: mimeType }));
  } else {
    form.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);
  }
  return form;
}

async function postFile(
  serverUrl: string,
  path: string,
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<Response> {
  const form = await buildForm(fileUri, fileName, mimeType);
  const response = await fetch(`${normalizeBaseUrl(serverUrl)}${path}`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    let detail = '';
    try {
      const parsed = JSON.parse(await response.text());
      detail = typeof parsed.detail === 'string' ? parsed.detail : '';
    } catch {
      detail = '';
    }
    throw new Error(detail || `שגיאת שרת (${response.status})`);
  }
  return response;
}

async function uploadFile<T>(
  serverUrl: string,
  path: string,
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<T> {
  const response = await postFile(serverUrl, path, fileUri, fileName, mimeType);
  return (await response.json()) as T;
}

/**
 * ממיר קובץ DWG/DXF ל-PDF דרך השרת ומחזיר URI מקומי של ה-PDF.
 * בנייטיב הקובץ נשמר בנתיב שמועבר ב-destUri; בווב מוחזר blob URL.
 */
export async function convertCadToPdf(
  serverUrl: string,
  fileUri: string,
  fileName: string,
  destUri: string
): Promise<string> {
  const response = await postFile(
    serverUrl,
    '/convert-cad',
    fileUri,
    fileName,
    'application/octet-stream'
  );
  const blob = await response.blob();
  if (Platform.OS === 'web') {
    return URL.createObjectURL(blob);
  }
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
  await FileSystem.writeAsStringAsync(destUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return destUri;
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
