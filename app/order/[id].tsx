import React, { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Order, orderPlanFiles } from '../../src/types';
import { getOrder } from '../../src/storage/orderRepo';
import { orderToText } from '../../src/share/orderText';
import { orderToHtml } from '../../src/share/orderHtml';
import { notify } from '../../src/ui/alerts';
import { printHtmlAsPdf } from '../../src/ui/printHtml';
import { colors, spacing, type, typo } from '../../src/ui/theme';
import Button from '../../src/components/ui/Button';
import Card from '../../src/components/ui/Card';
import GradientCard from '../../src/components/ui/GradientCard';
import ExtractionReportModal from '../../src/components/ExtractionReportModal';
import { strings } from '../../src/i18n/strings';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [showReport, setShowReport] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (id) getOrder(id).then(setOrder);
    }, [id])
  );

  const shareAsText = async () => {
    if (!order) return;
    const message = orderToText(order);
    if (Platform.OS === 'web') {
      if (navigator.share) {
        await navigator.share({ text: message }).catch(() => undefined);
      } else {
        await navigator.clipboard.writeText(message);
        notify(strings.copiedToClipboard);
      }
      return;
    }
    await Share.share({ message });
  };

  const shareAsPdf = async () => {
    if (!order) return;
    await printHtmlAsPdf(orderToHtml(order), order.title || strings.docTitle);
  };

  const openPlan = (uri: string) => {
    if (Platform.OS === 'web') {
      window.open(uri, '_blank');
      return;
    }
    router.push(`/plan-viewer?uri=${encodeURIComponent(uri)}`);
  };

  if (!order) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: strings.detailTitle }} />
        <Text style={[typo(type.body), { color: colors.textSecondary }]}>
          {strings.orderNotFound}
        </Text>
      </View>
    );
  }

  const totalSheets = order.lines.reduce((s, l) => s + l.quantity, 0);
  const totalBars = (order.barLines ?? []).reduce((s, l) => s + l.quantity, 0);
  const totalColumns = (order.columns ?? []).reduce((s, c) => s + c.count, 0);

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: order.title || strings.detailTitle }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[typo(type.caption), styles.meta]}>
          {strings.createdAt}: {fmtDate(order.createdAt)} · {strings.overlap}:{' '}
          {order.overlapCm} ס"מ
        </Text>

        <GradientCard>
          <Text style={[typo(type.secondary), styles.heroLabel]}>
            {strings.heroWeightLabel}
          </Text>
          <Text style={[typo(type.heroNumber), { color: colors.onPrimary }]}>
            {order.totalWeightKg.toFixed(0)} ק"ג
          </Text>
          <View style={styles.heroPills}>
            {totalSheets > 0 && (
              <View style={styles.heroPill}>
                <Text style={[typo(type.secondary), { color: colors.onPrimary }]}>
                  {totalSheets} רשתות
                </Text>
              </View>
            )}
            {totalBars > 0 && (
              <View style={styles.heroPill}>
                <Text style={[typo(type.secondary), { color: colors.onPrimary }]}>
                  {totalBars} מוטות
                </Text>
              </View>
            )}
            {totalColumns > 0 && (
              <View style={styles.heroPill}>
                <Text style={[typo(type.secondary), { color: colors.onPrimary }]}>
                  {totalColumns} עמודים
                </Text>
              </View>
            )}
          </View>
        </GradientCard>

        {order.aiExtraction && (
          <Pressable
            style={styles.reportRow}
            onPress={() => setShowReport(true)}
          >
            <MaterialCommunityIcons
              name="creation"
              size={18}
              color={colors.primary}
            />
            <Text
              style={[
                typo({ fontSize: 14, fontWeight: '700' }),
                { color: colors.primaryDeep, flex: 1, textAlign: 'right' },
              ]}
            >
              {strings.aiReportButton}
            </Text>
            <Feather
              name="chevron-left"
              size={18}
              color={colors.primary}
            />
          </Pressable>
        )}

        {order.lines.length > 0 && (
          <Card title={strings.orderLines}>
            {order.lines.map((line, i) => (
              <View
                key={i}
                style={[
                  styles.denseRow,
                  i < order.lines.length - 1 && styles.denseSeparator,
                ]}
              >
                <Text
                  style={[typo(type.body), { color: colors.text, flex: 1 }]}
                >
                  {strings.meshLine(
                    line.mesh.sheetLengthM,
                    line.mesh.sheetWidthM,
                    line.mesh.wireDiameterMm,
                    line.mesh.spacingCm
                  )}
                </Text>
                <Text
                  style={[typo(type.secondary), { color: colors.textSecondary }]}
                >
                  ×{line.quantity}
                </Text>
                <Text
                  style={[typo({ fontSize: 14, fontWeight: '700' }), { color: colors.text }]}
                >
                  {line.totalWeightKg.toFixed(0)} ק"ג
                </Text>
              </View>
            ))}
          </Card>
        )}

        {(order.barLines?.length ?? 0) > 0 && (
          <Card title={strings.barLinesTitle}>
            {order.barLines!.map((line, i) => (
              <View
                key={i}
                style={[
                  styles.denseRow,
                  i < order.barLines!.length - 1 && styles.denseSeparator,
                ]}
              >
                <Text style={[typo(type.body), { color: colors.text, flex: 1 }]}>
                  מוט Ø{line.diameterMm} × {line.lengthM} מ'
                </Text>
                <Text
                  style={[typo(type.secondary), { color: colors.textSecondary }]}
                >
                  ×{line.quantity}
                </Text>
                <Text
                  style={[typo({ fontSize: 14, fontWeight: '700' }), { color: colors.text }]}
                >
                  {line.totalWeightKg.toFixed(0)} ק"ג
                </Text>
              </View>
            ))}
          </Card>
        )}

        {(order.columns?.length ?? 0) > 0 && (
          <Card title={strings.columnsBreakdown}>
            {order.columns!.map((col, i) => {
              const r = order.columnResults?.find(
                (res) => res.columnId === col.id
              );
              if (!r) return null;
              return (
                <View
                  key={col.id}
                  style={[
                    styles.columnRow,
                    i < order.columns!.length - 1 && styles.denseSeparator,
                  ]}
                >
                  <Text style={[typo(type.rowTitle), { color: colors.text }]}>
                    {col.name} × {col.count} — {col.widthCm}/{col.depthCm} ס"מ,
                    גובה {col.heightM} מ'
                  </Text>
                  <Text
                    style={[typo(type.secondary), styles.columnMeta]}
                  >
                    {strings.longBars}: {r.longBarsTotal} × Ø
                    {col.longBarDiameterMm} ({strings.cutLength}{' '}
                    {r.longBarLengthM} מ') · {r.longBarsWeightKg.toFixed(0)} ק"ג
                  </Text>
                  <Text
                    style={[typo(type.secondary), styles.columnMeta]}
                  >
                    {strings.stirrups}: {r.stirrupsTotal} × Ø
                    {col.stirrupDiameterMm} @ {col.stirrupSpacingCm} ס"מ (
                    {strings.cutLength} {r.stirrupLengthM.toFixed(2)} מ') ·{' '}
                    {r.stirrupsWeightKg.toFixed(0)} ק"ג
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        {order.areas.length > 0 && (
          <Card title={strings.areasBreakdown}>
            {order.areas.map((area, i) => {
              const r = order.results.find((res) => res.areaId === area.id);
              if (!r) return null;
              return (
                <View
                  key={area.id}
                  style={[
                    styles.columnRow,
                    i < order.areas.length - 1 && styles.denseSeparator,
                  ]}
                >
                  <Text style={[typo(type.rowTitle), { color: colors.text }]}>
                    {area.name}: {area.lengthM}×{area.widthM} מ'
                  </Text>
                  <Text style={[typo(type.secondary), styles.columnMeta]}>
                    רשת {area.mesh.sheetWidthM}×{area.mesh.sheetLengthM} מ' Ø
                    {area.mesh.wireDiameterMm} @ {area.mesh.spacingCm}/
                    {area.mesh.spacingCm}
                    {area.overlapCm != null
                      ? ` · ${strings.overlap} ${area.overlapCm} ס"מ`
                      : ''}
                  </Text>
                  <Text style={[typo(type.secondary), styles.columnMeta]}>
                    {r.countAlongLength}×{r.countAlongWidth} רשתות (
                    {r.orientation === 'rotated'
                      ? strings.orientationRotated
                      : strings.orientationAsIs}
                    ) · {strings.waste}: {r.wastePct.toFixed(0)}%
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        {orderPlanFiles(order).map((f, i) => (
          <Button
            key={`${f.uri}-${i}`}
            label={`${strings.viewPlan} — ${f.name}`}
            onPress={() => openPlan(f.uri)}
            variant="tonal"
            icon="file-text"
            small
            style={styles.planBtn}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={strings.sharePdf}
          onPress={shareAsPdf}
          icon="share"
          small
          style={styles.footerGrow}
        />
        <Button
          label={strings.shareText}
          onPress={shareAsText}
          variant="tonal"
          small
          style={styles.footerGrow}
        />
        <Pressable
          style={styles.editBtn}
          onPress={() =>
            router.push(
              order.orderType === 'plan'
                ? `/plan-order?id=${order.id}`
                : `/new-order?id=${order.id}`
            )
          }
        >
          <Feather name="edit-2" size={18} color={colors.primaryDeep} />
        </Pressable>
      </View>

      {order.aiExtraction && (
        <ExtractionReportModal
          visible={showReport}
          report={order.aiExtraction}
          orderTitle={order.title}
          onClose={() => setShowReport(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  meta: {
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: spacing.md,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'right',
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primaryTint,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  denseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
  },
  denseSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  columnRow: {
    paddingVertical: spacing.md,
    gap: 4,
  },
  columnMeta: {
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
  },
  planBtn: {
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    backgroundColor: colors.card,
  },
  footerGrow: {
    flex: 1,
  },
  editBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
