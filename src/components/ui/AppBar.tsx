import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typo } from '../../ui/theme';

/** סרגל עליון לגרסת הווב: מותג שלחיצה עליו חוזרת למסך ההזמנות */
export default function AppBar() {
  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <Pressable
          style={styles.brand}
          onPress={() => router.replace('/')}
          hitSlop={8}
        >
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.brandTile}
          />
          <Text style={[typo({ fontSize: 18, fontWeight: '800' }), { color: colors.text }]}>
            IronNets
          </Text>
        </Pressable>
        <Pressable
          style={styles.homeLink}
          onPress={() => router.replace('/')}
          hitSlop={8}
        >
          <Feather name="home" size={16} color={colors.textSecondary} />
          <Text style={[typo({ fontSize: 14, fontWeight: '600' }), { color: colors.textSecondary }]}>
            הזמנות
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 64,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    justifyContent: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandTile: {
    width: 36,
    height: 36,
    borderRadius: radius.tile,
  },
  homeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
});
