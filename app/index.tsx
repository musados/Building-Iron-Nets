import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { OrderSummary } from '../src/types';
import { deleteOrder, listOrders } from '../src/storage/orderRepo';
import { confirmAction } from '../src/ui/alerts';
import { strings } from '../src/i18n/strings';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      listOrders().then(setOrders);
    }, [])
  );

  const confirmDelete = (id: string) => {
    confirmAction(
      strings.deleteOrder,
      strings.deleteOrderConfirm,
      strings.delete,
      async () => {
        await deleteOrder(id);
        setOrders(await listOrders());
      },
      true
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: strings.historyTitle }} />
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>{strings.emptyHistory}</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/order/${item.id}`)}
            onLongPress={() => confirmDelete(item.id)}
          >
            <Text style={styles.cardTitle}>
              {item.title || strings.docTitle}
            </Text>
            <Text style={styles.cardMeta}>
              {fmtDate(item.createdAt)} · {item.totalSheets}{' '}
              {strings.sheetsShort} · {item.totalWeightKg.toFixed(0)}{' '}
              {strings.kgShort}
            </Text>
          </Pressable>
        )}
      />
      <View style={styles.newButtonsRow}>
        <Pressable
          style={styles.newButton}
          onPress={() => router.push('/new-order')}
        >
          <Text style={styles.newButtonText}>+ {strings.simpleOrder}</Text>
          <Text style={styles.newButtonSub}>{strings.simpleOrderDesc}</Text>
        </Pressable>
        <Pressable
          style={[styles.newButton, styles.planButton]}
          onPress={() => router.push('/plan-order')}
        >
          <Text style={styles.newButtonText}>+ {strings.planOrder}</Text>
          <Text style={styles.newButtonSub}>{strings.planOrderDesc}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  empty: {
    textAlign: 'center',
    color: '#888',
    marginTop: 60,
    fontSize: 15,
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e0d8',
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'right',
  },
  cardMeta: {
    fontSize: 13,
    color: '#777',
    marginTop: 4,
    textAlign: 'right',
  },
  newButtonsRow: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
  },
  newButton: {
    flex: 1,
    backgroundColor: '#b45309',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  planButton: {
    backgroundColor: '#7c3f00',
  },
  newButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  newButtonSub: {
    color: '#ffffffcc',
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
});
