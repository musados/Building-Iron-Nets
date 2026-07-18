import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { strings } from '../i18n/strings';
import NumberField from './NumberField';

export interface AreaDraft {
  id: string;
  name: string;
  length: string;
  width: string;
  /** override של קוטר הרשת לשטח זה; ריק = ירושה מהמפרט הכללי */
  diameter: string;
  /** override של מרווח העיניים לשטח זה; ריק = ירושה מהמפרט הכללי */
  spacing: string;
}

interface Props {
  draft: AreaDraft;
  onChange: (draft: AreaDraft) => void;
  onDelete: () => void;
  canDelete: boolean;
  defaultDiameterMm: number;
  defaultSpacingCm: number;
}

export default function RectRow({
  draft,
  onChange,
  onDelete,
  canDelete,
  defaultDiameterMm,
  defaultSpacingCm,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <TextInput
          style={styles.nameInput}
          value={draft.name}
          onChangeText={(name) => onChange({ ...draft, name })}
          placeholder={strings.areaNamePlaceholder}
          placeholderTextColor="#999"
        />
        {canDelete && (
          <Pressable onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
            <Text style={styles.deleteText}>✕</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.dimsRow}>
        <NumberField
          label={strings.lengthLabel}
          value={draft.length}
          onChangeText={(length) => onChange({ ...draft, length })}
        />
        <NumberField
          label={strings.widthLabel}
          value={draft.width}
          onChangeText={(width) => onChange({ ...draft, width })}
        />
      </View>
      <View style={styles.dimsRow}>
        <NumberField
          label={strings.areaDiameterLabel}
          value={draft.diameter}
          onChangeText={(diameter) => onChange({ ...draft, diameter })}
          placeholder={String(defaultDiameterMm)}
        />
        <NumberField
          label={strings.areaSpacingLabel}
          value={draft.spacing}
          onChangeText={(spacing) => onChange({ ...draft, spacing })}
          placeholder={String(defaultSpacingCm)}
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
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
  dimsRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
