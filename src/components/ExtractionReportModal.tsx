import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AiExtractionReport, AiReportItem } from '../types';
import { extractionReportToHtml } from '../share/extractionHtml';
import { printHtmlAsPdf } from '../ui/printHtml';
import { colors } from '../ui/theme';
import { strings } from '../i18n/strings';

interface Props {
  visible: boolean;
  report: AiExtractionReport;
  orderTitle: string;
  onClose: () => void;
}

function Section({ title, items }: { title: string; items: AiReportItem[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.itemCard}>
          <Text style={styles.itemLabel}>{item.label}</Text>
          <Text style={styles.itemDerivation}>{item.derivation}</Text>
        </View>
      ))}
    </>
  );
}

export default function ExtractionReportModal({
  visible,
  report,
  orderTitle,
  onClose,
}: Props) {
  const print = () =>
    printHtmlAsPdf(
      extractionReportToHtml(report, orderTitle),
      strings.aiReportTitle
    );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{strings.aiReportTitle}</Text>
          <Text style={styles.disclaimer}>{strings.aiReportDisclaimer}</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            <Section title={strings.areasBreakdown} items={report.meshes} />
            <Section title={strings.barLinesTitle} items={report.bars} />
            <Section title={strings.columnsBreakdown} items={report.columns} />
            {report.notes ? (
              <>
                <Text style={styles.sectionTitle}>{strings.aiReportNotes}</Text>
                <Text style={styles.notes}>{report.notes}</Text>
              </>
            ) : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable style={styles.printBtn} onPress={print}>
              <Text style={styles.printBtnText}>{strings.aiReportPrint}</Text>
            </Pressable>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>{strings.close}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,32,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    paddingTop: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.warningText,
    backgroundColor: colors.warningTint,
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 16,
    textAlign: 'right',
    lineHeight: 18,
  },
  scroll: {
    flexGrow: 0,
  },
  body: {
    padding: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 14,
    marginBottom: 6,
    textAlign: 'right',
  },
  itemCard: {
    backgroundColor: colors.onPrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 12,
    marginBottom: 8,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
    marginBottom: 4,
  },
  itemDerivation: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 19,
  },
  notes: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 19,
    backgroundColor: colors.thinking,
    borderRadius: 8,
    padding: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  printBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  printBtnText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    flex: 1,
    backgroundColor: colors.onPrimary,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
