import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from '../../ui/theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

/** כרטיס hero עם גרדיאנט המותג (כחול פלדה) */
export default function GradientCard({ children, style }: Props) {
  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.hero,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
});
