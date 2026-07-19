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
  /** 0 = לא זוהה בתוכנית — האפליקציה תשתמש בברירת המחדל */
  wireDiameterMm: number;
  /** 0 = לא זוהה בתוכנית — האפליקציה תשתמש בברירת המחדל */
  spacingCm: number;
  derivation: string;
}

export interface ExtractedBar {
  diameterMm: number;
  lengthM: number;
  quantity: number;
  derivation: string;
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
  derivation: string;
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

export interface StreamingExtraction {
  promise: Promise<ExtractionResult>;
  cancel: () => void;
}

/**
 * חילוץ כמויות עם סטרימינג: השרת מחזיר NDJSON — אירועי progress (סיכום
 * החשיבה של המודל בזמן אמת) ולבסוף result או error. משתמשים ב-XHR כי
 * fetch ב-React Native לא תומך בקריאת גוף תגובה מדורגת.
 */
async function buildMultiForm(
  files: { uri: string; name: string }[]
): Promise<FormData> {
  const form = new FormData();
  for (const f of files) {
    if (Platform.OS === 'web') {
      const blob = await (await fetch(f.uri)).blob();
      form.append('files', new File([blob], f.name, { type: 'application/pdf' }));
    } else {
      form.append('files', {
        uri: f.uri,
        name: f.name,
        type: 'application/pdf',
      } as unknown as Blob);
    }
  }
  return form;
}

export function extractFromPdf(
  serverUrl: string,
  files: { uri: string; name: string }[],
  onProgress: (text: string) => void
): StreamingExtraction {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<ExtractionResult>((resolve, reject) => {
    let parsedIndex = 0;
    let result: ExtractionResult | null = null;
    let errorDetail = '';

    const processNewLines = () => {
      const text = xhr.responseText ?? '';
      let newline: number;
      while ((newline = text.indexOf('\n', parsedIndex)) !== -1) {
        const line = text.slice(parsedIndex, newline).trim();
        parsedIndex = newline + 1;
        if (!line) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'progress') onProgress(event.text);
          else if (event.type === 'result') result = event.data;
          else if (event.type === 'error') errorDetail = event.detail;
        } catch {
          // שורה חלקית/פגומה — מתעלמים
        }
      }
    };

    xhr.open(
      'POST',
      `${normalizeBaseUrl(serverUrl)}/extract-pdf`
    );
    xhr.responseType = 'text';
    xhr.onprogress = processNewLines;
    xhr.onerror = () => reject(new Error('שגיאת רשת מול השרת'));
    xhr.onabort = () => reject(new Error('cancelled'));
    xhr.onload = () => {
      processNewLines();
      if (xhr.status !== 200) {
        let detail = '';
        try {
          detail = JSON.parse(xhr.responseText)?.detail ?? '';
        } catch {
          detail = '';
        }
        reject(new Error(detail || `שגיאת שרת (${xhr.status})`));
      } else if (errorDetail) {
        reject(new Error(errorDetail));
      } else if (result) {
        resolve(result);
      } else {
        reject(new Error('תשובה ריקה מהשרת'));
      }
    };

    buildMultiForm(files)
      .then((form) => xhr.send(form))
      .catch(reject);
  });

  return { promise, cancel: () => xhr.abort() };
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
