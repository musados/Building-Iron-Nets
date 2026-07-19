import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { MeshSpec, Order, RectArea } from '../src/types';
import { DEFAULT_MESH, DEFAULT_OVERLAP_CM } from '../src/constants';
import { CalcError, computeOrder } from '../src/calc/mesh';
import { getOrder, saveOrder } from '../src/storage/orderRepo';
import { notify } from '../src/ui/alerts';
import { strings } from '../src/i18n/strings';
import MeshSpecPicker from '../src/components/MeshSpecPicker';
import RectRow, { AreaDraft } from '../src/components/RectRow';
import { parseNumber } from '../src/components/NumberField';

function newDraft(index: number): AreaDraft {
  return {
    id: Crypto.randomUUID(),
    name: `${strings.areaDefaultName} ${index}`,
    length: '',
    width: '',
    inherit: true,
    overlap: '',
    mesh: undefined,
  };
}

function meshEquals(a: MeshSpec, b: MeshSpec): boolean {
  return (
    a.sheetLengthM === b.sheetLengthM &&
    a.sheetWidthM === b.sheetWidthM &&
    a.wireDiameterMm === b.wireDiameterMm &&
    a.spacingCm === b.spacingCm
  );
}

function validMesh(m: MeshSpec): boolean {
  return (
    m.sheetLengthM > 0 &&
    m.sheetWidthM > 0 &&
    m.wireDiameterMm > 0 &&
    m.spacingCm > 0
  );
}

function draftsToAreas(
  drafts: AreaDraft[],
  mesh: MeshSpec
): RectArea[] | null {
  const areas: RectArea[] = [];
  for (const d of drafts) {
    const lengthM = parseNumber(d.length);
    const widthM = parseNumber(d.width);
    if (!lengthM || !widthM || lengthM <= 0 || widthM <= 0) return null;
    if (d.inherit || !d.mesh) {
      areas.push({
        id: d.id,
        name: d.name.trim() || strings.areaDefaultName,
        lengthM,
        widthM,
        mesh: { ...mesh },
      });
      continue;
    }
    if (!validMesh(d.mesh)) return null;
    const overlapCm = parseNumber(d.overlap);
    if (overlapCm === null || overlapCm < 0) return null;
    areas.push({
      id: d.id,
      name: d.name.trim() || strings.areaDefaultName,
      lengthM,
      widthM,
      mesh: { ...d.mesh },
      overlapCm,
    });
  }
  return areas;
}

export default function NewOrderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [title, setTitle] = useState('');
  const [overlap, setOverlap] = useState(String(DEFAULT_OVERLAP_CM));
  const [mesh, setMesh] = useState<MeshSpec>(DEFAULT_MESH);
  const [drafts, setDrafts] = useState<AreaDraft[]>([newDraft(1)]);
  const [existingCreatedAt, setExistingCreatedAt] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!id) return;
    getOrder(id).then((order) => {
      if (!order) return;
      setTitle(order.title);
      setOverlap(String(order.overlapCm));
      setExistingCreatedAt(order.createdAt);
      const firstMesh = order.areas[0]?.mesh ?? DEFAULT_MESH;
      setMesh(firstMesh);
      setDrafts(
        order.areas.map((a) => {
          const inherit = a.overlapCm == null && meshEquals(a.mesh, firstMesh);
          return {
            id: a.id,
            name: a.name,
            length: String(a.lengthM),
            width: String(a.widthM),
            inherit,
            overlap: String(a.overlapCm ?? order.overlapCm),
            mesh: inherit ? undefined : { ...a.mesh },
          };
        })
      );
    });
  }, [id]);

  const summary = useMemo(() => {
    const overlapCm = parseNumber(overlap);
    if (overlapCm === null || overlapCm < 0) return null;
    if (mesh.sheetLengthM <= 0 || mesh.sheetWidthM <= 0) return null;
    const areas = draftsToAreas(drafts, mesh);
    if (!areas || areas.length === 0) return null;
    try {
      return computeOrder(areas, overlapCm);
    } catch (e) {
      if (e instanceof CalcError) return { error: e.message };
      throw e;
    }
  }, [drafts, mesh, overlap]);

  const updateDraft = (updated: AreaDraft) => {
    setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const save = async () => {
    const overlapCm = parseNumber(overlap);
    const areas =
      overlapCm !== null && overlapCm >= 0
        ? draftsToAreas(drafts, mesh)
        : null;
    if (!areas || areas.length === 0 || overlapCm === null) {
      notify(strings.invalidInput);
      return;
    }
    try {
      const computation = computeOrder(areas, overlapCm);
      const order: Order = {
        id: id ?? Crypto.randomUUID(),
        createdAt: existingCreatedAt ?? new Date().toISOString(),
        title: title.trim(),
        overlapCm,
        areas,
        results: computation.results,
        lines: computation.lines,
        totalWeightKg: computation.totalWeightKg,
      };
      await saveOrder(order);
      router.replace(`/order/${order.id}`);
    } catch (e) {
      if (e instanceof CalcError) {
        notify(e.message);
        return;
      }
      throw e;
    }
  };

  const hasError = summary !== null && 'error' in summary;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{ title: id ? strings.editorTitleEdit : strings.editorTitle }}
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>{strings.orderTitleLabel}</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder={strings.orderTitlePlaceholder}
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>{strings.overlapLabel}</Text>
        <TextInput
          style={styles.overlapInput}
          value={overlap}
          onChangeText={setOverlap}
          keyboardType="decimal-pad"
        />

        <Text style={styles.sectionTitle}>{strings.meshSectionTitle}</Text>
        <MeshSpecPicker value={mesh} onChange={setMesh} />

        <Text style={styles.sectionTitle}>{strings.areasSectionTitle}</Text>
        {drafts.map((d) => (
          <RectRow
            key={d.id}
            draft={d}
            onChange={updateDraft}
            onDelete={() =>
              setDrafts((prev) => prev.filter((x) => x.id !== d.id))
            }
            canDelete={drafts.length > 1}
            globalMesh={mesh}
            globalOverlapCm={overlap}
          />
        ))}
        <Pressable
          style={styles.addButton}
          onPress={() =>
            setDrafts((prev) => [...prev, newDraft(prev.length + 1)])
          }
        >
          <Text style={styles.addButtonText}>+ {strings.addArea}</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.summaryText}>
          {summary === null
            ? strings.invalidInput
            : 'error' in summary
              ? summary.error
              : strings.liveSummary(
                  summary.lines.reduce((s, l) => s + l.quantity, 0),
                  summary.totalWeightKg
                )}
        </Text>
        <Pressable
          style={[styles.saveButton, (summary === null || hasError) && styles.saveDisabled]}
          onPress={save}
          disabled={summary === null || hasError}
        >
          <Text style={styles.saveButtonText}>{strings.saveAndShow}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
    marginTop: 8,
    textAlign: 'right',
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: 'right',
    backgroundColor: '#fff',
    color: '#1a1a1a',
  },
  overlapInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: 'right',
    backgroundColor: '#fff',
    color: '#1a1a1a',
    width: 120,
    alignSelf: 'flex-start',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 4,
    textAlign: 'right',
  },
  addButton: {
    borderWidth: 1,
    borderColor: '#b45309',
    borderRadius: 10,
    borderStyle: 'dashed',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: {
    color: '#b45309',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e0d8',
    backgroundColor: '#fff',
    padding: 14,
    paddingBottom: 28,
    gap: 10,
  },
  summaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#b45309',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveDisabled: {
    backgroundColor: '#d0c5b5',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
