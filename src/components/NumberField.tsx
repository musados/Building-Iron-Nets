import React from 'react';
import { StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { colors, hit, radius, type, typo } from '../ui/theme';

interface Props {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  style?: ViewStyle;
}

/** קלט מספרי: מקבל גם נקודה וגם פסיק עשרוני (מקלדת עברית ב-iOS) */
export function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export default function NumberField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  style,
}: Props) {
  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={[typo(type.caption), styles.label]}>{label}</Text>
      ) : null}
      <TextInput
        style={[
          styles.input,
          typo(type.body),
          error ? styles.inputError : null,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType="decimal-pad"
      />
      {error ? (
        <Text style={[typo(type.caption), styles.error]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    color: colors.textSecondary,
    marginBottom: 4,
    textAlign: 'right',
  },
  input: {
    minHeight: hit.input,
    backgroundColor: colors.fillInput,
    borderRadius: radius.tile,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'right',
    color: colors.text,
  },
  inputError: {
    borderWidth: 1,
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    marginTop: 4,
    textAlign: 'right',
  },
});
