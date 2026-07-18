import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { strings } from '../i18n/strings';

interface Props {
  visible: boolean;
  progressText: string;
  onCancel: () => void;
}

/** דיאלוג "המודל חושב" עם סיכום החשיבה הזורם מהשרת בזמן אמת */
export default function ExtractionProgressModal({
  visible,
  progressText,
  onCancel,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <ActivityIndicator color="#b45309" size="small" />
            <Text style={styles.title}>{strings.extractingTitle}</Text>
          </View>
          <ScrollView
            ref={scrollRef}
            style={styles.thinkingBox}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: true })
            }
          >
            <Text style={styles.thinkingText}>
              {progressText || strings.extracting}
            </Text>
          </ScrollView>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>{strings.cancel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fdfcfa',
    borderRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  thinkingBox: {
    backgroundColor: '#f7f4ef',
    borderRadius: 10,
    padding: 12,
    minHeight: 120,
    maxHeight: 320,
  },
  thinkingText: {
    fontSize: 13,
    color: '#444',
    textAlign: 'right',
    lineHeight: 20,
  },
  cancelBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#b45309',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '600',
  },
});
