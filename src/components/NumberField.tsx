import React from 'react';
import { StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';

interface Props {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
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
  style,
}: Props) {
  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        keyboardType="decimal-pad"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: 'right',
    backgroundColor: '#fff',
    color: '#1a1a1a',
  },
});
