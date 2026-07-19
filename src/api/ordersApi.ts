/**
 * לקוח ל-API ההזמנות בשרת התוכן (server/orders.py).
 * כל בקשה נשלחת עם Bearer token; על 401 מנסים רענון אחד וחוזרים על הבקשה.
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Order, PlanFile } from '../types';
import { forceRefreshAccessToken, getAccessToken } from '../auth/session';
import { getServerUrl } from '../storage/settings';

export interface RemoteOrderMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteFileMeta {
  id: string;
  name: string;
  sizeBytes?: number;
}

async function baseUrl(): Promise<string> {
  const url = (await getServerUrl()).trim().replace(/\/+$/, '');
  if (!url) throw new Error('לא הוגדרה כתובת שרת');
  return url;
}

async function extractDetail(response: Response): Promise<string> {
  try {
    const parsed = JSON.parse(await response.text());
    return typeof parsed.detail === 'string' ? parsed.detail : '';
  } catch {
    return '';
  }
}

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = await baseUrl();
  const send = async (token: string) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    });

  let response = await send(await getAccessToken());
  if (response.status === 401) {
    response = await send(await forceRefreshAccessToken());
  }
  if (!response.ok) {
    throw new Error(
      (await extractDetail(response)) || `שגיאת שרת (${response.status})`
    );
  }
  return response;
}

export async function listRemoteOrders(): Promise<RemoteOrderMeta[]> {
  const response = await authFetch('/orders');
  return ((await response.json()) as { orders: RemoteOrderMeta[] }).orders;
}

export async function fetchRemoteOrder(
  id: string
): Promise<{ order: Order; files: RemoteFileMeta[] }> {
  const response = await authFetch(`/orders/${id}`);
  return (await response.json()) as { order: Order; files: RemoteFileMeta[] };
}

export async function pushRemoteOrder(order: Order): Promise<void> {
  await authFetch(`/orders/${order.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  });
}

export async function deleteRemoteOrder(id: string): Promise<void> {
  await authFetch(`/orders/${id}`, { method: 'DELETE' });
}

export async function uploadPlanFile(
  orderId: string,
  file: PlanFile
): Promise<RemoteFileMeta> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append('file', new File([blob], file.name, { type: 'application/pdf' }));
  } else {
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: 'application/pdf',
    } as unknown as Blob);
  }
  const response = await authFetch(`/orders/${orderId}/files`, {
    method: 'POST',
    body: form,
  });
  return (await response.json()) as RemoteFileMeta;
}

/**
 * מוריד קובץ תוכנית מהשרת. בנייטיב נשמר ל-destUri ומוחזר הנתיב;
 * בווב מוחזר blob URL.
 */
export async function downloadPlanFile(
  orderId: string,
  fileId: string,
  destUri: string
): Promise<string> {
  const base = await baseUrl();
  const url = `${base}/orders/${orderId}/files/${fileId}`;
  const token = await getAccessToken();
  if (Platform.OS === 'web') {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(
        (await extractDetail(response)) || `שגיאת שרת (${response.status})`
      );
    }
    return URL.createObjectURL(await response.blob());
  }
  const result = await FileSystem.downloadAsync(url, destUri, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (result.status !== 200) {
    throw new Error(`הורדת הקובץ נכשלה (${result.status})`);
  }
  return result.uri;
}
