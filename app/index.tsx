import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { OrderSummary } from '../src/types';
import { deleteOrder, listOrders } from '../src/storage/orderRepo';
import { isSignedIn } from '../src/auth/session';
import {
  deleteOrderOnServer,
  pullOrdersFromServer,
} from '../src/sync/orderSync';
import { confirmAction } from '../src/ui/alerts';
import { colors, hit, radius, shadow, spacing, type, typo } from '../src/ui/theme';
import Button from '../src/components/ui/Button';
import IconTile from '../src/components/ui/IconTile';
import Chip from '../src/components/ui/Chip';
import { strings } from '../src/i18n/strings';

type Filter = 'all' | 'ai' | 'manual';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function metaLine(item: OrderSummary): string {
  const parts = [fmtDate(item.createdAt)];
  if (item.totalSheets > 0) parts.push(`${item.totalSheets} רשתות`);
  if ((item.totalBars ?? 0) > 0) parts.push(`${item.totalBars} מוטות`);
  if ((item.totalColumns ?? 0) > 0) parts.push(`${item.totalColumns} עמודים`);
  parts.push(`${item.totalWeightKg.toFixed(0)} ק"ג`);
  return parts.join(' · ');
}

export default function HistoryScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      listOrders().then(setOrders);
      // משיכת הזמנות מהשרת ברקע (רק כשמחוברים); כשל רשת לא מפריע למסך
      pullOrdersFromServer()
        .then((added) => {
          if (added > 0) listOrders().then(setOrders);
        })
        .catch(() => undefined);
    }, [])
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    return orders.filter((o) => {
      if (q && !o.title.includes(q)) return false;
      if (filter === 'ai') return o.hasAi === true;
      if (filter === 'manual') return o.hasAi !== true;
      return true;
    });
  }, [orders, search, filter]);

  const confirmDelete = (id: string) => {
    confirmAction(
      strings.deleteOrder,
      strings.deleteOrderConfirm,
      strings.delete,
      async () => {
        await deleteOrder(id);
        deleteOrderOnServer(id);
        setOrders(await listOrders());
      },
      true
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.titleRow}>
          <Text style={[typo(type.largeTitle), { color: colors.text }]}>
            {strings.historyTitle}
          </Text>
          {orders.length > 0 && (
            <View style={styles.countBadge}>
              <Text
                style={[
                  typo({ fontSize: 13, fontWeight: '600' }),
                  { color: colors.primary },
                ]}
              >
                {orders.length}
              </Text>
            </View>
          )}
          <View style={styles.titleSpacer} />
          <Pressable
            hitSlop={8}
            style={styles.accountBtn}
            onPress={() => router.push('/sign-in')}
          >
            <Feather
              name={isSignedIn() ? 'user-check' : 'user'}
              size={20}
              color={isSignedIn() ? colors.primary : colors.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Feather name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, typo(type.body)]}
            value={search}
            onChangeText={setSearch}
            placeholder={strings.searchPlaceholder}
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <View style={styles.filterRow}>
          <Chip
            label={strings.filterAll}
            selected={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <Chip
            label={strings.filterAi}
            selected={filter === 'ai'}
            onPress={() => setFilter('ai')}
          />
          <Chip
            label={strings.filterManual}
            selected={filter === 'manual'}
            onPress={() => setFilter('manual')}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Feather name="layers" size={28} color={colors.primary} />
              </View>
              <Text
                style={[
                  typo(type.cardTitle),
                  { color: colors.text, textAlign: 'center' },
                ]}
              >
                {strings.emptyHistory}
              </Text>
              <Text
                style={[
                  typo(type.secondary),
                  {
                    color: colors.textSecondary,
                    textAlign: 'center',
                    lineHeight: 20,
                  },
                ]}
              >
                {strings.emptyHistoryHint}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/order/${item.id}`)}
              onLongPress={() => confirmDelete(item.id)}
            >
              <IconTile
                icon="grid"
                tone={item.hasAi ? 'tint' : 'gray'}
              />
              <View style={styles.cardTexts}>
                <View style={styles.cardTitleRow}>
                  <Text
                    style={[typo(type.cardTitle), { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.title || strings.docTitle}
                  </Text>
                  {item.hasAi && (
                    <View style={styles.aiBadge}>
                      <Text
                        style={[typo(type.badge), { color: colors.primary }]}
                      >
                        {strings.aiBadge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    typo(type.secondary),
                    { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {metaLine(item)}
                </Text>
              </View>
              <Feather
                name="chevron-left"
                size={20}
                color={colors.textTertiary}
              />
            </Pressable>
          )}
        />
      </View>

      <View style={styles.ctaWrap} pointerEvents="box-none">
        <LinearGradient
          colors={['rgba(242,242,247,0)', colors.bg]}
          style={styles.ctaFade}
          pointerEvents="none"
        />
        <View style={styles.ctas}>
          <Button
            label={strings.planOrderCta}
            onPress={() => router.push('/plan-order')}
            iconNode={
              <MaterialCommunityIcons
                name="creation"
                size={18}
                color={colors.onPrimary}
              />
            }
          />
          <Button
            label={strings.simpleOrderCta}
            onPress={() => router.push('/new-order')}
            variant="tonal"
            icon="plus"
            small
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? colors.bgWeb : colors.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  countBadge: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  titleSpacer: {
    flex: 1,
  },
  accountBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.fillSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.fillInput,
    borderRadius: radius.tile,
    paddingHorizontal: 12,
    minHeight: hit.input,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    textAlign: 'right',
    paddingVertical: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  listContent: {
    paddingBottom: 150,
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: Platform.OS === 'android' ? radius.cardAndroid : radius.card,
    padding: spacing.lg,
    ...shadow.card,
  },
  cardTexts: {
    flex: 1,
    gap: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aiBadge: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 60,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  ctaFade: {
    height: 40,
  },
  ctas: {
    backgroundColor: Platform.OS === 'web' ? colors.bgWeb : colors.bg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
  },
});
