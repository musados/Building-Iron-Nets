import React from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MeshSpec } from '../types';
import { strings } from '../i18n/strings';
import NumberField from './NumberField';
import MeshSpecPicker from './MeshSpecPicker';

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
}

export default function RectRow({
  draft,
  onChange,
  onDelete,
  canDelete,
  globalMesh,
  globalOverlapCm,
}: Props) {
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
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <TextInput
          style={styles.nameInput}
          value={draft.name}
          onChangeText={(name) => onChange({ ...draft, name })}
          placeholder={strings.areaNamePlaceholder}
          placeholderTextColor="#999"
        />
        {canDelete && (
          <Pressable onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
            <Text style={styles.deleteText}>✕</Text>
          </Pressable>
        )}
      </View>
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
        <Switch
          value={draft.inherit}
          onValueChange={toggleInherit}
          trackColor={{ true: '#b45309', false: '#ccc' }}
          thumbColor="#fff"
        />
        <Text style={styles.inheritLabel}>{strings.inheritFromGlobal}</Text>
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
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#faf8f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e0d8',
    padding: 12,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'right',
    paddingVertical: 4,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0e8dd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#8a6d3b',
    fontSize: 14,
    fontWeight: '700',
  },
  dimsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inheritRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  inheritLabel: {
    flex: 1,
    fontSize: 13,
    color: '#555',
    textAlign: 'right',
  },
  ownSpec: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#e5e0d8',
    paddingTop: 4,
  },
  groupLabel: {
    fontSize: 13,
    color: '#555',
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'right',
  },
  overlapRow: {
    flexDirection: 'row',
  },
  overlapSpacer: {
    flex: 2,
  },
});
