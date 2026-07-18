import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MeshSpec } from '../types';
import { DIAMETERS_MM, PRESET_SHEETS, SPACINGS_CM } from '../constants';
import { strings } from '../i18n/strings';
import NumberField, { parseNumber } from './NumberField';

interface Props {
  value: MeshSpec;
  onChange: (spec: MeshSpec) => void;
  customLength: string;
  customWidth: string;
  onCustomLengthChange: (text: string) => void;
  onCustomWidthChange: (text: string) => void;
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function MeshSpecPicker({
  value,
  onChange,
  customLength,
  customWidth,
  onCustomLengthChange,
  onCustomWidthChange,
}: Props) {
  const applyCustomDims = (lengthText: string, widthText: string) => {
    const l = parseNumber(lengthText);
    const w = parseNumber(widthText);
    onChange({
      ...value,
      isCustomSize: true,
      sheetLengthM: l && l > 0 ? l : 0,
      sheetWidthM: w && w > 0 ? w : 0,
    });
  };

  return (
    <View>
      <Text style={styles.groupLabel}>{strings.sheetSizeLabel}</Text>
      <View style={styles.chipRow}>
        {PRESET_SHEETS.map((p) => {
          const selected =
            !value.isCustomSize &&
            value.sheetLengthM === p.sheetLengthM &&
            value.sheetWidthM === p.sheetWidthM;
          return (
            <Chip
              key={`${p.sheetLengthM}x${p.sheetWidthM}`}
              label={`${p.sheetWidthM}×${p.sheetLengthM}`}
              selected={selected}
              onPress={() =>
                onChange({
                  ...value,
                  isCustomSize: false,
                  sheetLengthM: p.sheetLengthM,
                  sheetWidthM: p.sheetWidthM,
                })
              }
            />
          );
        })}
        <Chip
          label={strings.customSize}
          selected={value.isCustomSize}
          onPress={() => applyCustomDims(customLength, customWidth)}
        />
      </View>

      {value.isCustomSize && (
        <View style={styles.customRow}>
          <NumberField
            label={strings.customLength}
            value={customLength}
            onChangeText={(t) => {
              onCustomLengthChange(t);
              applyCustomDims(t, customWidth);
            }}
          />
          <NumberField
            label={strings.customWidth}
            value={customWidth}
            onChangeText={(t) => {
              onCustomWidthChange(t);
              applyCustomDims(customLength, t);
            }}
          />
        </View>
      )}

      <Text style={styles.groupLabel}>{strings.diameterLabel}</Text>
      <View style={styles.chipRow}>
        {DIAMETERS_MM.map((d) => (
          <Chip
            key={d}
            label={String(d)}
            selected={value.wireDiameterMm === d}
            onPress={() => onChange({ ...value, wireDiameterMm: d })}
          />
        ))}
      </View>

      <Text style={styles.groupLabel}>{strings.spacingLabel}</Text>
      <View style={styles.chipRow}>
        {SPACINGS_CM.map((s) => (
          <Chip
            key={s}
            label={`${s}/${s}`}
            selected={value.spacingCm === s}
            onPress={() => onChange({ ...value, spacingCm: s })}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  groupLabel: {
    fontSize: 13,
    color: '#555',
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'right',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  chipSelected: {
    backgroundColor: '#b45309',
    borderColor: '#b45309',
  },
  chipText: {
    fontSize: 15,
    color: '#333',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  customRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
});
