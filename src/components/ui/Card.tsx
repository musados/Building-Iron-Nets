import React from 'react';
import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing, type, typo } from '../../ui/theme';

interface Props {
  title?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

/** כרטיס לבן סטנדרטי עם כותרת מקטע אפורה אופציונלית */
export default function Card({ title, headerRight, children, style }: Props) {
  return (
    <View style={[styles.card, style]}>
      {(title || headerRight) && (
        <View style={styles.headerRow}>
          {title ? (
            <Text
              style={[
                typo(type.sectionLabel),
                { color: colors.textSecondary },
              ]}
            >
              {title}
            </Text>
          ) : (
            <View />
          )}
          {headerRight}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: Platform.OS === 'android' ? radius.cardAndroid : radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
});
