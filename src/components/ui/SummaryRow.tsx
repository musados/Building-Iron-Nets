import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, hit, radius, spacing, type, typo } from '../../ui/theme';

interface Props {
  title: string;
  meta?: string;
  badge?: string;
  expanded?: boolean;
  onPress: () => void;
  onDelete?: () => void;
  isLast?: boolean;
}

/** שורת סיכום בתוך כרטיס: כותרת + מטא + תג אזהרה, נפתחת לעריכה */
export default function SummaryRow({
  title,
  meta,
  badge,
  expanded,
  onPress,
  onDelete,
  isLast,
}: Props) {
  return (
    <View style={[styles.row, !isLast && styles.separator]}>
      {onDelete && (
        <Pressable onPress={onDelete} style={styles.deleteBtn} hitSlop={6}>
          <Feather name="x" size={16} color={colors.textSecondary} />
        </Pressable>
      )}
      <Pressable style={styles.main} onPress={onPress}>
        <View style={styles.texts}>
          <View style={styles.titleRow}>
            <Text
              style={[typo(type.rowTitle), { color: colors.text }]}
              numberOfLines={2}
            >
              {title}
            </Text>
            {badge ? (
              <View style={styles.badge}>
                <Text
                  style={[typo(type.badge), { color: colors.warningText }]}
                >
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
          {meta ? (
            <Text
              style={[typo(type.secondary), { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {meta}
            </Text>
          ) : null}
        </View>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textTertiary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: hit.minTarget + 8,
    gap: spacing.sm,
  },
  separator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: colors.warningTint,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.fillSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
