/**
 * סנכרון הזמנות בין האחסון המקומי לשרת.
 *
 * המכשיר הוא מקור האמת להזמנות שקיימות בו; מהשרת נמשכות רק הזמנות
 * שאינן קיימות מקומית. קבצי תוכנית מועלים רק אם המשתמש בחר בכך —
 * אחרת ה-URIs בהזמנה מצביעים על קבצים מקומיים במכשיר בלבד.
 */
import { Order } from '../types';
import {
  deleteRemoteOrder,
  fetchRemoteOrder,
  listRemoteOrders,
  pushRemoteOrder,
  uploadPlanFile,
} from '../api/ordersApi';
import { initSession, isSignedIn } from '../auth/session';
import { getOrder, saveOrder } from '../storage/orderRepo';

/**
 * דוחף הזמנה לשרת. עם uploadFiles — מעלה גם קבצי תוכנית שטרם הועלו,
 * ומעדכן את ההזמנה (בשרת ומקומית) עם מזהי הקבצים שבשרת.
 * מחזיר את ההזמנה המעודכנת.
 */
export async function pushOrderToServer(
  order: Order,
  uploadFiles: boolean
): Promise<Order> {
  let next = order;
  await pushRemoteOrder(next);
  if (uploadFiles && next.planFiles && next.planFiles.length > 0) {
    const files = [...next.planFiles];
    let changed = false;
    for (let i = 0; i < files.length; i++) {
      if (files[i].serverFileId) continue;
      const uploaded = await uploadPlanFile(next.id, files[i]);
      files[i] = { ...files[i], serverFileId: uploaded.id };
      changed = true;
    }
    if (changed) {
      next = { ...next, planFiles: files };
      await pushRemoteOrder(next);
      await saveOrder(next);
    }
  }
  return next;
}

/** מושך מהשרת הזמנות שלא קיימות במכשיר. מחזיר כמה נוספו. */
export async function pullOrdersFromServer(): Promise<number> {
  await initSession();
  if (!isSignedIn()) return 0;
  const remote = await listRemoteOrders();
  let added = 0;
  for (const meta of remote) {
    const local = await getOrder(meta.id);
    if (local) continue;
    const fetched = await fetchRemoteOrder(meta.id);
    await saveOrder(fetched.order);
    added++;
  }
  return added;
}

/** מחיקה מהשרת אחרי מחיקה מקומית — לא חוסמת ולא מפילה את ה-UI. */
export function deleteOrderOnServer(id: string): void {
  initSession()
    .then(() => (isSignedIn() ? deleteRemoteOrder(id) : undefined))
    .catch(() => undefined);
}
