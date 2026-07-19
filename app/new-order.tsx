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
import { Feather } from '@expo/vector-icons';
import { getOrder, saveOrder } from '../src/storage/orderRepo';
import { confirmAction, notify } from '../src/ui/alerts';
import { colors, spacing, type, typo } from '../src/ui/theme';
import { strings } from '../src/i18n/strings';
import Button from '../src/components/ui/Button';
import Card from '../src/components/ui/Card';
import MeshSpecPicker from '../src/components/MeshSpecPicker';
import RectRow, { AreaDraft } from '../src/components/RectRow';
import NumberField, { parseNumber } from '../src/components/NumberField';

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
        options={{
          title: id ? strings.editorTitleEdit : strings.editorTitle,
          headerRight: () => (
            <Pressable
              onPress={() =>
                confirmAction(
                  strings.closeOrderTitle,
                  strings.closeOrderConfirm,
                  strings.close,
                  () => router.replace('/'),
                  true
                )
              }
              hitSlop={10}
            >
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <Text style={[typo(type.caption), styles.fieldLabel]}>
            {strings.orderTitleLabel}
          </Text>
          <TextInput
            style={[styles.textField, typo(type.body)]}
            value={title}
            onChangeText={setTitle}
            placeholder={strings.orderTitlePlaceholder}
            placeholderTextColor={colors.textTertiary}
          />
        </Card>

        <Card title={strings.globalSpecTitle}>
          <Text style={[typo(type.caption), styles.fieldLabel]}>
            {strings.overlapLabel}
          </Text>
          <View style={styles.overlapRow}>
            <NumberField value={overlap} onChangeText={setOverlap} />
            <View style={styles.overlapSpacer} />
          </View>
          <MeshSpecPicker value={mesh} onChange={setMesh} />
        </Card>

        <Card
          title={strings.areasSectionTitle}
          headerRight={
            <Pressable
              onPress={() =>
                setDrafts((prev) => [...prev, newDraft(prev.length + 1)])
              }
              hitSlop={8}
            >
              <Text
                style={[
                  typo({ fontSize: 14, fontWeight: '700' }),
                  { color: colors.primary },
                ]}
              >
                {strings.addLink}
              </Text>
            </Pressable>
          }
        >
          {drafts.map((d, i) => (
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
              isLast={i === drafts.length - 1}
            />
          ))}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={[typo(type.caption), { color: colors.textSecondary }]}>
            {strings.estimatedTotal}
          </Text>
          <Text
            style={[typo({ fontSize: 17, fontWeight: '800' }), { color: colors.text }]}
          >
            {summary === null
              ? strings.invalidInput
              : 'error' in summary
                ? summary.error
                : strings.liveSummary(
                    summary.lines.reduce((s, l) => s + l.quantity, 0),
                    summary.totalWeightKg
                  )}
          </Text>
        </View>
        <Button
          label={strings.saveAndShow}
          onPress={save}
          disabled={summary === null || hasError}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  fieldLabel: {
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: 6,
  },
  textField: {
    backgroundColor: colors.fillInput,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    color: colors.text,
    textAlign: 'right',
  },
  overlapRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  overlapSpacer: {
    flex: 2,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    backgroundColor: colors.card,
    padding: spacing.lg,
    paddingBottom: 28,
    gap: spacing.md,
  },
  totalRow: {
    alignItems: 'center',
    gap: 2,
  },
});
