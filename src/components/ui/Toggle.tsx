import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../../ui/theme';

interface Props {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

/**
 * מתג מותאם — Switch של react-native-web מרנדר thumb בצבע ברירת מחדל
 * שמנותק מהמסילה כשמעצבים את ה-track, לכן בנוי כאן ידנית.
 */
export default function Toggle({ value, onValueChange }: Props) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={10}
      style={[styles.track, value ? styles.trackOn : styles.trackOff]}
    >
      <View style={styles.thumb} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 48,
    height: 28,
    borderRadius: 999,
    padding: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackOn: {
    backgroundColor: colors.primary,
    justifyContent: 'flex-end',
  },
  trackOff: {
    backgroundColor: colors.chipOutline,
    justifyContent: 'flex-start',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.card,
    shadowColor: '#0f1720',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
