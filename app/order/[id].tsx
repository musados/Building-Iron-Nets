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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Order } from '../../src/types';
import { getOrder } from '../../src/storage/orderRepo';
import { orderToText } from '../../src/share/orderText';
import { orderToHtml } from '../../src/share/orderHtml';
import { notify } from '../../src/ui/alerts';
import { printHtmlAsPdf } from '../../src/ui/printHtml';
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

  const openPlan = () => {
    if (!order?.planFileUri) return;
    if (Platform.OS === 'web') {
      window.open(order.planFileUri, '_blank');
      return;
    }
    router.push(`/plan-viewer?uri=${encodeURIComponent(order.planFileUri)}`);
  };

  if (!order) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: strings.detailTitle }} />
        <Text style={styles.notFound}>{strings.orderNotFound}</Text>
      </View>
    );
  }

  const totalSheets = order.lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{ title: order.title || strings.detailTitle }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {order.aiExtraction && (
          <Pressable
            style={styles.reportBtn}
            onPress={() => setShowReport(true)}
          >
            <Text style={styles.reportBtnText}>
              🔍 {strings.aiReportButton}
            </Text>
          </Pressable>
        )}
        <Text style={styles.meta}>
          {strings.createdAt}: {fmtDate(order.createdAt)} · {strings.overlap}:{' '}
          {order.overlapCm} ס"מ
        </Text>

        <Text style={styles.sectionTitle}>{strings.orderLines}</Text>
        {order.lines.map((line, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.cardTitle}>
              {strings.meshLine(
                line.mesh.sheetLengthM,
                line.mesh.sheetWidthM,
                line.mesh.wireDiameterMm,
                line.mesh.spacingCm
              )}
            </Text>
            <Text style={styles.cardMeta}>
              {strings.quantity}: {line.quantity} {strings.units} ·{' '}
              {strings.unitWeight}: {line.unitWeightKg.toFixed(1)} ק"ג ·{' '}
              {strings.totalWeight}: {line.totalWeightKg.toFixed(0)} ק"ג
            </Text>
          </View>
        ))}

        {(order.barLines?.length ?? 0) > 0 && (
          <>
            <Text style={styles.sectionTitle}>{strings.barLinesTitle}</Text>
            {order.barLines!.map((line, i) => (
              <View key={i} style={styles.card}>
                <Text style={styles.cardTitle}>
                  מוט Ø{line.diameterMm} מ"מ × {line.lengthM} מ'
                </Text>
                <Text style={styles.cardMeta}>
                  {strings.quantity}: {line.quantity} {strings.units} ·{' '}
                  {strings.unitWeight}: {line.unitWeightKg.toFixed(1)} ק"ג ·{' '}
                  {strings.totalWeight}: {line.totalWeightKg.toFixed(0)} ק"ג
                </Text>
              </View>
            ))}
          </>
        )}

        {(order.columns?.length ?? 0) > 0 && (
          <>
            <Text style={styles.sectionTitle}>{strings.columnsBreakdown}</Text>
            {order.columns!.map((col) => {
              const r = order.columnResults?.find(
                (res) => res.columnId === col.id
              );
              if (!r) return null;
              return (
                <View key={col.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {col.name} × {col.count} — {col.widthCm}/{col.depthCm} ס"מ,
                    גובה {col.heightM} מ'
                  </Text>
                  <Text style={styles.cardMeta}>
                    {strings.longBars}: {r.longBarsTotal} × Ø
                    {col.longBarDiameterMm} ({strings.cutLength}{' '}
                    {r.longBarLengthM} מ') · {r.longBarsWeightKg.toFixed(0)} ק"ג
                  </Text>
                  <Text style={styles.cardMeta}>
                    {strings.stirrups}: {r.stirrupsTotal} × Ø
                    {col.stirrupDiameterMm} @ {col.stirrupSpacingCm} ס"מ (
                    {strings.cutLength} {r.stirrupLengthM.toFixed(2)} מ') ·{' '}
                    {r.stirrupsWeightKg.toFixed(0)} ק"ג
                  </Text>
                </View>
              );
            })}
          </>
        )}

        <View style={styles.totalsBox}>
          <Text style={styles.totalsText}>
            {strings.grandTotalSheets}: {totalSheets}
          </Text>
          <Text style={styles.totalsText}>
            {strings.grandTotalWeight}: {order.totalWeightKg.toFixed(0)} ק"ג
          </Text>
        </View>

        {order.planFileUri && (
          <Pressable style={styles.planBtn} onPress={openPlan}>
            <Text style={styles.planBtnText}>
              {strings.viewPlan}
              {order.planFileName ? ` — ${order.planFileName}` : ''}
            </Text>
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>{strings.areasBreakdown}</Text>
        {order.areas.map((area) => {
          const r = order.results.find((res) => res.areaId === area.id);
          if (!r) return null;
          return (
            <View key={area.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {area.name}: {area.lengthM}×{area.widthM} מ'
              </Text>
              <Text style={styles.cardMeta}>
                רשת Ø{area.mesh.wireDiameterMm} @ {area.mesh.spacingCm}/
                {area.mesh.spacingCm} · {r.sheetCount} רשתות ·{' '}
                {strings.layout}: {r.countAlongLength}×
                {r.countAlongWidth} (
                {r.orientation === 'rotated'
                  ? strings.orientationRotated
                  : strings.orientationAsIs}
                ) · {strings.waste}: {r.wastePct.toFixed(0)}%
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.actionBtn} onPress={shareAsPdf}>
          <Text style={styles.actionText}>{strings.sharePdf}</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={shareAsText}>
          <Text style={styles.actionText}>{strings.shareText}</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() =>
            router.push(
              order.orderType === 'plan'
                ? `/plan-order?id=${order.id}`
                : `/new-order?id=${order.id}`
            )
          }
        >
          <Text style={[styles.actionText, styles.editText]}>
            {strings.edit}
          </Text>
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
  notFound: {
    fontSize: 16,
    color: '#888',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  meta: {
    fontSize: 13,
    color: '#777',
    textAlign: 'right',
    marginBottom: 8,
  },
  reportBtn: {
    backgroundColor: '#fdf3e3',
    borderWidth: 1,
    borderColor: '#e5c88f',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  reportBtnText: {
    color: '#7c3f00',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'right',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e0d8',
    padding: 12,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'right',
  },
  cardMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    textAlign: 'right',
    lineHeight: 20,
  },
  planBtn: {
    backgroundColor: '#7c3f00',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  planBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  totalsBox: {
    backgroundColor: '#f5f0e8',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    gap: 4,
  },
  totalsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7c3f00',
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#e5e0d8',
    backgroundColor: '#fff',
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#b45309',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  editBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#b45309',
  },
  editText: {
    color: '#b45309',
  },
});
