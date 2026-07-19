import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { MeshSpec } from '../types';
import { colors, spacing, type, typo } from '../ui/theme';
import { strings } from '../i18n/strings';
import NumberField from './NumberField';
import MeshSpecPicker from './MeshSpecPicker';
import SummaryRow from './ui/SummaryRow';
import Toggle from './ui/Toggle';

export interface AreaDraft {
  id: string;
  name: string;
  length: string;
  width: string;
  /** true = חפייה ומפרט הרשת יורשים מההגדרות הכלליות של ההזמנה */
  inherit: boolean;
  /** חפייה ייחודית לשטח (בס"מ) — בשימוש רק כאשר inherit=false */
  overlap: string;
  /** מפרט רשת ייחודי לשטח — בשימוש רק כאשר inherit=false */
  mesh?: MeshSpec;
}

interface Props {
  draft: AreaDraft;
  onChange: (draft: AreaDraft) => void;
  onDelete: () => void;
  canDelete: boolean;
  globalMesh: MeshSpec;
  globalOverlapCm: string;
  isLast?: boolean;
}

function draftMeta(draft: AreaDraft): string {
  const dims =
    draft.length && draft.width ? `${draft.length}×${draft.width} מ'` : '—';
  if (draft.inherit || !draft.mesh) return `${dims} · ${strings.globalSpec}`;
  const m = draft.mesh;
  return `${dims} · רשת ${m.sheetWidthM}×${m.sheetLengthM} Ø${m.wireDiameterMm}@${m.spacingCm} · ${strings.overlap} ${draft.overlap}`;
}

export default function RectRow({
  draft,
  onChange,
  onDelete,
  canDelete,
  globalMesh,
  globalOverlapCm,
  isLast,
}: Props) {
  const [expanded, setExpanded] = useState(draft.length === '');

  const toggleInherit = (inherit: boolean) => {
    if (inherit) {
      onChange({ ...draft, inherit: true });
    } else {
      // בכיבוי הירושה — מתחילים מהערכים הגלובליים הנוכחיים
      onChange({
        ...draft,
        inherit: false,
        overlap: draft.overlap || globalOverlapCm,
        mesh: draft.mesh ?? { ...globalMesh },
      });
    }
  };

  return (
    <View>
      <SummaryRow
        title={draft.name || strings.areaDefaultName}
        meta={draftMeta(draft)}
        badge={!draft.inherit ? strings.customSpecBadge : undefined}
        expanded={expanded}
        onPress={() => setExpanded((e) => !e)}
        onDelete={canDelete ? onDelete : undefined}
        isLast={isLast && !expanded}
      />
      {expanded && (
        <View style={[styles.editor, !isLast && styles.separator]}>
          <TextInput
            style={[styles.nameInput, typo(type.rowTitle)]}
            value={draft.name}
            onChangeText={(name) => onChange({ ...draft, name })}
            placeholder={strings.areaNamePlaceholder}
            placeholderTextColor={colors.textTertiary}
          />
          <View style={styles.dimsRow}>
            <NumberField
              label={strings.lengthLabel}
              value={draft.length}
              onChangeText={(length) => onChange({ ...draft, length })}
            />
            <NumberField
              label={strings.widthLabel}
              value={draft.width}
              onChangeText={(width) => onChange({ ...draft, width })}
            />
          </View>

          <View style={styles.inheritRow}>
            <Toggle value={draft.inherit} onValueChange={toggleInherit} />
            <Text
              style={[typo(type.secondary), { color: colors.textSecondary, flex: 1, textAlign: 'right' }]}
            >
              {strings.inheritFromGlobal}
            </Text>
          </View>

          {!draft.inherit && draft.mesh && (
            <View style={styles.ownSpec}>
              <Text style={styles.groupLabel}>{strings.overlapLabel}</Text>
              <View style={styles.overlapRow}>
                <NumberField
                  value={draft.overlap}
                  onChangeText={(overlap) => onChange({ ...draft, overlap })}
                />
                <View style={styles.overlapSpacer} />
              </View>
              <MeshSpecPicker
                value={draft.mesh}
                onChange={(mesh) => onChange({ ...draft, mesh })}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  editor: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  separator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    marginBottom: spacing.sm,
  },
  nameInput: {
    backgroundColor: colors.fillInput,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    color: colors.text,
    textAlign: 'right',
  },
  dimsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inheritRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ownSpec: {
    gap: spacing.xs,
  },
  groupLabel: {
    ...typo(type.sectionLabel),
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  overlapRow: {
    flexDirection: 'row',
  },
  overlapSpacer: {
    flex: 2,
  },
});
