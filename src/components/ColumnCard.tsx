import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, spacing, type, typo } from '../ui/theme';
import { strings } from '../i18n/strings';
import NumberField from './NumberField';
import SummaryRow from './ui/SummaryRow';

export interface ColumnDraft {
  id: string;
  name: string;
  count: string;
  width: string;
  depth: string;
  height: string;
  cover: string;
  longBarCount: string;
  longBarDiameter: string;
  stirrupDiameter: string;
  stirrupSpacing: string;
}

interface Props {
  draft: ColumnDraft;
  onChange: (draft: ColumnDraft) => void;
  onDelete: () => void;
  isLast?: boolean;
}

function columnMeta(d: ColumnDraft): string {
  const parts: string[] = [];
  if (d.width && d.depth) parts.push(`${d.width}/${d.depth} ס"מ`);
  if (d.height) parts.push(`גובה ${d.height} מ'`);
  if (d.longBarCount && d.longBarDiameter) {
    parts.push(`${d.longBarCount}×Ø${d.longBarDiameter}`);
  }
  if (d.stirrupDiameter && d.stirrupSpacing) {
    parts.push(`חישוק Ø${d.stirrupDiameter}@${d.stirrupSpacing}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export default function ColumnCard({
  draft,
  onChange,
  onDelete,
  isLast,
}: Props) {
  const [expanded, setExpanded] = useState(draft.height === '');
  const set = (patch: Partial<ColumnDraft>) => onChange({ ...draft, ...patch });

  return (
    <View>
      <SummaryRow
        title={`${draft.name || 'עמוד'}${draft.count ? ` × ${draft.count}` : ''}`}
        meta={columnMeta(draft)}
        expanded={expanded}
        onPress={() => setExpanded((e) => !e)}
        onDelete={onDelete}
        isLast={isLast && !expanded}
      />
      {expanded && (
        <View style={[styles.editor, !isLast && styles.separator]}>
          <TextInput
            style={[styles.nameInput, typo(type.rowTitle)]}
            value={draft.name}
            onChangeText={(name) => set({ name })}
            placeholder={strings.columnNamePlaceholder}
            placeholderTextColor={colors.textTertiary}
          />
          <View style={styles.grid}>
            <NumberField
              label={strings.columnCount}
              value={draft.count}
              onChangeText={(count) => set({ count })}
              style={styles.cell}
            />
            <NumberField
              label={strings.columnHeight}
              value={draft.height}
              onChangeText={(height) => set({ height })}
              style={styles.cell}
            />
            <NumberField
              label={strings.columnCover}
              value={draft.cover}
              onChangeText={(cover) => set({ cover })}
              style={styles.cell}
            />
            <NumberField
              label={strings.columnWidth}
              value={draft.width}
              onChangeText={(width) => set({ width })}
              style={styles.cell}
            />
            <NumberField
              label={strings.columnDepth}
              value={draft.depth}
              onChangeText={(depth) => set({ depth })}
              style={styles.cell}
            />
            <NumberField
              label={strings.longBarCount}
              value={draft.longBarCount}
              onChangeText={(longBarCount) => set({ longBarCount })}
              style={styles.cell}
            />
            <NumberField
              label={strings.longBarDiameter}
              value={draft.longBarDiameter}
              onChangeText={(longBarDiameter) => set({ longBarDiameter })}
              style={styles.cell}
            />
            <NumberField
              label={strings.stirrupDiameter}
              value={draft.stirrupDiameter}
              onChangeText={(stirrupDiameter) => set({ stirrupDiameter })}
              style={styles.cell}
            />
            <NumberField
              label={strings.stirrupSpacing}
              value={draft.stirrupSpacing}
              onChangeText={(stirrupSpacing) => set({ stirrupSpacing })}
              style={styles.cell}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  editor: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  separator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    marginBottom: spacing.sm,
  },
  nameInput: {
    backgroundColor: colors.fillInput,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    color: colors.text,
    textAlign: 'right',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cell: {
    flexBasis: '30%',
    flexGrow: 1,
  },
});
