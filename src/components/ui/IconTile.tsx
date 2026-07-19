import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius } from '../../ui/theme';

interface Props {
  icon: keyof typeof Feather.glyphMap;
  /** tint = כחול (הזמנות AI), gray = ידני */
  tone?: 'tint' | 'gray';
}

export default function IconTile({ icon, tone = 'tint' }: Props) {
  const tinted = tone === 'tint';
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: tinted ? colors.primaryTint : colors.fillSubtle },
      ]}
    >
      <Feather
        name={icon}
        size={20}
        color={tinted ? colors.primary : colors.textSecondary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
