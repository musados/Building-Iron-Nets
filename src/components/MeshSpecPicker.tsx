import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MeshSpec } from '../types';
import { DIAMETERS_MM, PRESET_SHEETS, SPACINGS_CM } from '../constants';
import { strings } from '../i18n/strings';
import { colors, type, typo } from '../ui/theme';
import NumberField, { parseNumber } from './NumberField';
import Chip from './ui/Chip';

interface Props {
  value: MeshSpec;
  onChange: (spec: MeshSpec) => void;
}

/**
 * בורר מפרט רשת (צ'יפים): מידת פלטה, קוטר, מרווח — כולל ערכים מותאמים
 * אישית למידה ולמרווח. מנהל את שדות הטקסט המותאמים בעצמו.
 */
export default function MeshSpecPicker({ value, onChange }: Props) {
  const [customLength, setCustomLength] = useState('');
  const [customWidth, setCustomWidth] = useState('');
  const [customSpacing, setCustomSpacing] = useState('');
  const [customSpacingOn, setCustomSpacingOn] = useState(
    !SPACINGS_CM.includes(value.spacingCm)
  );

  // סנכרון בטעינת ערך חיצוני (למשל עריכת הזמנה קיימת)
  useEffect(() => {
    if (value.isCustomSize) {
      setCustomLength((prev) => prev || String(value.sheetLengthM || ''));
      setCustomWidth((prev) => prev || String(value.sheetWidthM || ''));
    }
    if (!SPACINGS_CM.includes(value.spacingCm)) {
      setCustomSpacingOn(true);
      setCustomSpacing((prev) => prev || String(value.spacingCm || ''));
    }
  }, [
    value.isCustomSize,
    value.sheetLengthM,
    value.sheetWidthM,
    value.spacingCm,
  ]);

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

  const applyCustomSpacing = (text: string) => {
    const s = parseNumber(text);
    onChange({ ...value, spacingCm: s && s > 0 ? s : 0 });
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
              setCustomLength(t);
              applyCustomDims(t, customWidth);
            }}
          />
          <NumberField
            label={strings.customWidth}
            value={customWidth}
            onChangeText={(t) => {
              setCustomWidth(t);
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
            selected={!customSpacingOn && value.spacingCm === s}
            onPress={() => {
              setCustomSpacingOn(false);
              onChange({ ...value, spacingCm: s });
            }}
          />
        ))}
        <Chip
          label={strings.customSpacing}
          selected={customSpacingOn}
          onPress={() => {
            setCustomSpacingOn(true);
            applyCustomSpacing(customSpacing);
          }}
        />
      </View>

      {customSpacingOn && (
        <View style={styles.customRow}>
          <NumberField
            label={strings.customSpacingLabel}
            value={customSpacing}
            onChangeText={(t) => {
              setCustomSpacing(t);
              applyCustomSpacing(t);
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  groupLabel: {
    ...typo(type.sectionLabel),
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'right',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
});
