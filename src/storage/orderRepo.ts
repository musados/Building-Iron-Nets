import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order, OrderSummary } from '../types';

const INDEX_KEY = 'orders:index';
const orderKey = (id: string) => `order:${id}`;

export async function listOrders(): Promise<OrderSummary[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const index = JSON.parse(raw) as OrderSummary[];
    return index.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function getOrder(id: string): Promise<Order | null> {
  const raw = await AsyncStorage.getItem(orderKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Order;
  } catch {
    return null;
  }
}

export async function saveOrder(order: Order): Promise<void> {
  const summary: OrderSummary = {
    id: order.id,
    title: order.title,
    createdAt: order.createdAt,
    totalSheets: order.lines.reduce((sum, l) => sum + l.quantity, 0),
    totalWeightKg: order.totalWeightKg,
    totalBars: (order.barLines ?? []).reduce((sum, l) => sum + l.quantity, 0),
    totalColumns: (order.columns ?? []).reduce((sum, c) => sum + c.count, 0),
    orderType: order.orderType ?? 'simple',
    hasAi: order.aiExtraction != null,
  };
  const index = await listOrders();
  const next = [summary, ...index.filter((s) => s.id !== order.id)];
  await AsyncStorage.multiSet([
    [orderKey(order.id), JSON.stringify(order)],
    [INDEX_KEY, JSON.stringify(next)],
  ]);
}

export async function deleteOrder(id: string): Promise<void> {
  const index = await listOrders();
  await AsyncStorage.multiRemove([orderKey(id)]);
  await AsyncStorage.setItem(
    INDEX_KEY,
    JSON.stringify(index.filter((s) => s.id !== id))
  );
}
