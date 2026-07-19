import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, hit, radius, shadow, type, typo } from '../../ui/theme';

export type ButtonVariant = 'primary' | 'tonal' | 'dashed' | 'gray';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Feather.glyphMap;
  /** אייקון חופשי (למשל MaterialCommunityIcons) — עוקף את icon */
  iconNode?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: ViewStyle | ViewStyle[];
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconNode,
  disabled,
  loading,
  small,
  style,
}: Props) {
  const height = small ? hit.buttonSecondary : hit.buttonPrimary;
  const textColor =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'gray'
        ? colors.textSecondary
        : colors.primaryDeep;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { height },
        variant === 'primary' && [
          styles.primary,
          !disabled && shadow.primaryButton,
          pressed && { backgroundColor: colors.primaryPressed },
        ],
        variant === 'tonal' && styles.tonal,
        variant === 'gray' && styles.gray,
        variant === 'dashed' && styles.dashed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          iconNode ??
          (icon && <Feather name={icon} size={18} color={textColor} />)
        )}
        <Text style={[typo(type.button), { color: textColor }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  tonal: {
    backgroundColor: colors.primaryTint,
  },
  gray: {
    backgroundColor: colors.fillSubtle,
  },
  dashed: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashedAdd,
    borderRadius: radius.card,
  },
  disabled: {
    backgroundColor: colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
});
