import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { notify } from './alerts';
import { strings } from '../i18n/strings';

/**
 * הדפסה/שיתוף של מסמך HTML כ-PDF:
 * - נייטיב: יצירת PDF ושיתוף דרך ה-share sheet.
 * - ווב: פתיחת המסמך בחלון חדש והפעלת דיאלוג ההדפסה עליו
 *   (Print.printAsync בדפדפן מדפיס את העמוד הנוכחי ומתעלם מה-HTML).
 */
export async function printHtmlAsPdf(html: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (!win) {
      notify(strings.popupBlocked);
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.document.title = title;
    win.focus();
    setTimeout(() => win.print(), 350);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
  });
}
