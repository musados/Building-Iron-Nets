import { Alert, Platform } from 'react-native';

/**
 * Alert.alert של React Native אינו ממומש בדפדפן (no-op) —
 * העזרים כאן עוטפים אותו עם window.alert / window.confirm בווב.
 */

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function confirmAction(
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void,
  destructive = false
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'ביטול', style: 'cancel' },
    {
      text: confirmText,
      style: destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}
