import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../ui/theme';
import { strings } from '../i18n/strings';
import NumberField from './NumberField';
import SummaryRow from './ui/SummaryRow';

export interface BarDraft {
  id: string;
  diameter: string;
  length: string;
  quantity: string;
}

interface Props {
  draft: BarDraft;
  onChange: (draft: BarDraft) => void;
  onDelete: () => void;
  isLast?: boolean;
}

function barTitle(draft: BarDraft): string {
  if (!draft.diameter || !draft.length) return strings.barLinesTitle;
  return `מוט Ø${draft.diameter} × ${draft.length} מ'`;
}

export default function BarRow({ draft, onChange, onDelete, isLast }: Props) {
  const [expanded, setExpanded] = useState(draft.quantity === '');

  return (
    <View>
      <SummaryRow
        title={barTitle(draft)}
        meta={draft.quantity ? `${draft.quantity} ${strings.units}` : '—'}
        expanded={expanded}
        onPress={() => setExpanded((e) => !e)}
        onDelete={onDelete}
        isLast={isLast && !expanded}
      />
      {expanded && (
        <View style={[styles.editor, !isLast && styles.separator]}>
          <View style={styles.row}>
            <NumberField
              label={strings.barDiameter}
              value={draft.diameter}
              onChangeText={(diameter) => onChange({ ...draft, diameter })}
            />
            <NumberField
              label={strings.barLength}
              value={draft.length}
              onChangeText={(length) => onChange({ ...draft, length })}
            />
            <NumberField
              label={strings.barQuantity}
              value={draft.quantity}
              onChangeText={(quantity) => onChange({ ...draft, quantity })}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  editor: {
    paddingBottom: spacing.lg,
  },
  separator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.12)',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
