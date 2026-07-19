import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, type, typo } from '../ui/theme';
import { strings } from '../i18n/strings';
import Button from './ui/Button';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (withFiles: boolean) => void;
}

/**
 * בחירת אופן השמירה בשרת למשתמש מחובר עם קבצי תוכנית:
 * ברירת המחדל היא "תוצאה בלבד" — עם אזהרה שהקבצים יישארו רק במכשיר.
 */
export default function SaveChoiceModal({ visible, onClose, onSave }: Props) {
  const [withFiles, setWithFiles] = useState(false);

  useEffect(() => {
    if (visible) setWithFiles(false);
  }, [visible]);

  const option = (
    selected: boolean,
    title: string,
    description: string,
    onPress: () => void
  ) => (
    <Pressable
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
    >
      <Feather
        name={selected ? 'check-circle' : 'circle'}
        size={20}
        color={selected ? colors.primary : colors.textTertiary}
      />
      <View style={styles.optionTexts}>
        <Text style={[typo(type.rowTitle), { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[typo(type.caption), { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={[typo(type.cardTitle), { color: colors.text }]}>
            {strings.saveToServerTitle}
          </Text>
          <Text style={[typo(type.secondary), { color: colors.textSecondary }]}>
            {strings.saveToServerSubtitle}
          </Text>

          {option(
            !withFiles,
            strings.saveResultOnly,
            strings.saveResultOnlyDesc,
            () => setWithFiles(false)
          )}
          {option(
            withFiles,
            strings.saveWithFiles,
            strings.saveWithFilesDesc,
            () => setWithFiles(true)
          )}

          {!withFiles && (
            <View style={styles.warning}>
              <Feather
                name="alert-triangle"
                size={16}
                color={colors.warningText}
              />
              <Text style={[typo(type.caption), styles.warningText]}>
                {strings.resultOnlyWarning}
              </Text>
            </View>
          )}

          <View style={styles.buttons}>
            <Button
              label={strings.save}
              onPress={() => onSave(withFiles)}
              small
            />
            <Button
              label={strings.cancel}
              onPress={onClose}
              variant="gray"
              small
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.xl,
    gap: spacing.md,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    ...shadow.card,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.fillInput,
    borderRadius: radius.tile,
    padding: spacing.md,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  optionTexts: {
    flex: 1,
    gap: 2,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningTint,
    borderRadius: radius.tile,
    padding: spacing.md,
  },
  warningText: {
    flex: 1,
    color: colors.warningText,
    lineHeight: 18,
  },
  buttons: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
