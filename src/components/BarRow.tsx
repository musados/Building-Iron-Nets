import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { strings } from '../i18n/strings';
import NumberField from './NumberField';

export interface BarDraft {
  id: string;
  diameter: string;
  length: string;
  quantity: string;
}

interface Props {
  draft: BarDraft;
  onChange: (draft: BarDraft) => void;
  onDelete: () => void;
}

export default function BarRow({ draft, onChange, onDelete }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <NumberField
          label={strings.barDiameter}
          value={draft.diameter}
          onChangeText={(diameter) => onChange({ ...draft, diameter })}
        />
        <NumberField
          label={strings.barLength}
          value={draft.length}
          onChangeText={(length) => onChange({ ...draft, length })}
        />
        <NumberField
          label={strings.barQuantity}
          value={draft.quantity}
          onChangeText={(quantity) => onChange({ ...draft, quantity })}
        />
        <Pressable onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
          <Text style={styles.deleteText}>✕</Text>
        </Pressable>
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0e8dd',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  deleteText: {
    color: '#8a6d3b',
    fontSize: 14,
    fontWeight: '700',
  },
});
