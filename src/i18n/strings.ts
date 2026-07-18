export const strings = {
  appName: 'IronNets — רשתות ברזל',

  // History screen
  historyTitle: 'הזמנות',
  newOrder: 'הזמנה חדשה',
  emptyHistory: 'אין עדיין הזמנות.\nלחץ על "הזמנה חדשה" כדי להתחיל.',
  deleteOrder: 'מחיקת הזמנה',
  deleteOrderConfirm: 'למחוק את ההזמנה לצמיתות?',
  delete: 'מחק',
  cancel: 'ביטול',
  sheetsShort: 'רשתות',
  kgShort: 'ק"ג',

  // Editor screen
  editorTitle: 'הזמנה חדשה',
  editorTitleEdit: 'עריכת הזמנה',
  orderTitleLabel: 'שם הפרויקט / אתר',
  orderTitlePlaceholder: 'למשל: תקרה קומה ב\'',
  overlapLabel: 'חפייה (ס"מ)',
  meshSectionTitle: 'מפרט הרשת',
  sheetSizeLabel: 'מידת פלטה (מ\')',
  customSize: 'מידה אחרת',
  customLength: 'אורך (מ\')',
  customWidth: 'רוחב (מ\')',
  diameterLabel: 'קוטר ברזל (מ"מ)',
  spacingLabel: 'מרווח עיניים (ס"מ)',
  areasSectionTitle: 'שטחים לכיסוי',
  addArea: 'הוסף שטח',
  areaNamePlaceholder: 'שם השטח',
  areaDefaultName: 'שטח',
  lengthLabel: 'אורך (מ\')',
  widthLabel: 'רוחב (מ\')',
  saveAndShow: 'שמור והצג',
  invalidInput: 'יש למלא מידות תקינות בכל השטחים',
  liveSummary: (sheets: number, weightKg: number) =>
    `סה"כ: ${sheets} רשתות · ${weightKg.toFixed(0)} ק"ג`,

  // Detail screen
  detailTitle: 'פירוט הזמנה',
  orderLines: 'שורות הזמנה',
  areasBreakdown: 'פירוט שטחים',
  quantity: 'כמות',
  unitWeight: 'משקל יח\'',
  totalWeight: 'משקל כולל',
  grandTotalWeight: 'סה"כ משקל',
  grandTotalSheets: 'סה"כ רשתות',
  overlap: 'חפייה',
  orientationRotated: 'מסובב',
  orientationAsIs: 'רגיל',
  waste: 'פחת',
  layout: 'פריסה',
  sharePdf: 'שתף PDF',
  shareText: 'שתף כטקסט',
  edit: 'ערוך',
  orderNotFound: 'ההזמנה לא נמצאה',
  createdAt: 'תאריך',

  // Shared document
  docTitle: 'הזמנת רשתות ברזל',
  meshLine: (l: number, w: number, d: number, s: number) =>
    `רשת ${l}×${w} מ' — Ø${d} מ"מ @ ${s}/${s} ס"מ`,
  units: 'יח\'',
};
