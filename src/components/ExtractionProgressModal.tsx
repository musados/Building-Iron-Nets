import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, type, typo } from '../ui/theme';
import { strings } from '../i18n/strings';

interface Props {
  visible: boolean;
  progressText: string;
  onCancel: () => void;
}

/** גיליון תחתון "המודל מנתח" — פס התקדמות וסיכום חשיבה זורם עם סמן מהבהב */
export default function ExtractionProgressModal({
  visible,
  progressText,
  onCancel,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const barAnim = useRef(new Animated.Value(0)).current;
  const cursorAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const bar = Animated.loop(
      Animated.timing(barAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      })
    );
    const cursor = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorAnim, {
          toValue: 0,
          duration: 450,
          useNativeDriver: false,
        }),
        Animated.timing(cursorAnim, {
          toValue: 1,
          duration: 450,
          useNativeDriver: false,
        }),
      ])
    );
    bar.start();
    cursor.start();
    return () => {
      bar.stop();
      cursor.stop();
      barAnim.setValue(0);
    };
  }, [visible, barAnim, cursorAnim]);

  const barTranslate = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-30%', '110%'],
  });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            style={styles.iconCircle}
          >
            <MaterialCommunityIcons
              name="creation"
              size={24}
              color={colors.onPrimary}
            />
          </LinearGradient>
          <Text style={[typo({ fontSize: 18, fontWeight: '800' }), styles.title]}>
            {strings.extractingTitle}
          </Text>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { transform: [{ translateX: barTranslate as unknown as number }] },
              ]}
            >
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.progressGradient}
              />
            </Animated.View>
          </View>

          <Text style={[typo(type.sectionLabel), styles.thinkingLabel]}>
            {strings.modelThinking}
          </Text>
          <ScrollView
            ref={scrollRef}
            style={styles.thinkingBox}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: true })
            }
          >
            <Text style={[typo(type.secondary), styles.thinkingText]}>
              {progressText || strings.extracting}
              <Animated.Text
                style={[styles.cursor, { opacity: cursorAnim }]}
              >
                ▍
              </Animated.Text>
            </Text>
          </ScrollView>

          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={[typo(type.button), { color: colors.primaryDeep }]}>
              {strings.cancel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(15,23,32,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: spacing.xl,
    paddingBottom: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    ...shadow.sheet,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.chipOutline,
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.fillSubtle,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  progressFill: {
    width: '30%',
    height: '100%',
  },
  progressGradient: {
    flex: 1,
    borderRadius: 999,
  },
  thinkingLabel: {
    color: colors.textSecondary,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  thinkingBox: {
    width: '100%',
    backgroundColor: colors.thinking,
    borderRadius: 16,
    padding: spacing.md,
    minHeight: 110,
    maxHeight: 260,
    marginBottom: spacing.lg,
  },
  thinkingText: {
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 22,
  },
  cursor: {
    color: colors.primary,
  },
  cancelBtn: {
    backgroundColor: colors.primaryTint,
    borderRadius: 999,
    minHeight: 48,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
