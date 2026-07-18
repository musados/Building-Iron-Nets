import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { strings } from '../i18n/strings';
import NumberField from './NumberField';

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
}

export default function ColumnCard({ draft, onChange, onDelete }: Props) {
  const set = (patch: Partial<ColumnDraft>) => onChange({ ...draft, ...patch });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <TextInput
          style={styles.nameInput}
          value={draft.name}
          onChangeText={(name) => set({ name })}
          placeholder={strings.columnNamePlaceholder}
          placeholderTextColor="#999"
        />
        <Pressable onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
          <Text style={styles.deleteText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <NumberField
          label={strings.columnCount}
          value={draft.count}
          onChangeText={(count) => set({ count })}
        />
        <NumberField
          label={strings.columnHeight}
          value={draft.height}
          onChangeText={(height) => set({ height })}
        />
        <NumberField
          label={strings.columnCover}
          value={draft.cover}
          onChangeText={(cover) => set({ cover })}
        />
      </View>

      <View style={styles.row}>
        <NumberField
          label={strings.columnWidth}
          value={draft.width}
          onChangeText={(width) => set({ width })}
        />
        <NumberField
          label={strings.columnDepth}
          value={draft.depth}
          onChangeText={(depth) => set({ depth })}
        />
      </View>

      <View style={styles.row}>
        <NumberField
          label={strings.longBarCount}
          value={draft.longBarCount}
          onChangeText={(longBarCount) => set({ longBarCount })}
        />
        <NumberField
          label={strings.longBarDiameter}
          value={draft.longBarDiameter}
          onChangeText={(longBarDiameter) => set({ longBarDiameter })}
        />
      </View>

      <View style={styles.row}>
        <NumberField
          label={strings.stirrupDiameter}
          value={draft.stirrupDiameter}
          onChangeText={(stirrupDiameter) => set({ stirrupDiameter })}
        />
        <NumberField
          label={strings.stirrupSpacing}
          value={draft.stirrupSpacing}
          onChangeText={(stirrupSpacing) => set({ stirrupSpacing })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#faf8f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e0d8',
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'right',
    paddingVertical: 4,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0e8dd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#8a6d3b',
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
});
