import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  AiExtractionReport,
  BarItem,
  ColumnItem,
  MeshSpec,
  Order,
  orderPlanFiles,
  PlanFile,
  RectArea,
} from '../src/types';
import { DEFAULT_MESH, DEFAULT_OVERLAP_CM } from '../src/constants';
import { CalcError, computeOrder } from '../src/calc/mesh';
import { computePlanExtras } from '../src/calc/rebar';
import { getOrder, saveOrder } from '../src/storage/orderRepo';
import { getServerUrl, setServerUrl } from '../src/storage/settings';
import {
  convertCadToPdf,
  extractFromPdf,
  ExtractionResult,
} from '../src/api/serverApi';
import { confirmAction, notify } from '../src/ui/alerts';
import { colors, spacing, type, typo } from '../src/ui/theme';
import { strings } from '../src/i18n/strings';
import Button from '../src/components/ui/Button';
import Card from '../src/components/ui/Card';
import GradientCard from '../src/components/ui/GradientCard';
import IconTile from '../src/components/ui/IconTile';
import MeshSpecPicker from '../src/components/MeshSpecPicker';
import ExtractionReportModal from '../src/components/ExtractionReportModal';
import ExtractionProgressModal from '../src/components/ExtractionProgressModal';
import RectRow, { AreaDraft } from '../src/components/RectRow';
import BarRow, { BarDraft } from '../src/components/BarRow';
import ColumnCard, { ColumnDraft } from '../src/components/ColumnCard';
import NumberField, { parseNumber } from '../src/components/NumberField';

function newAreaDraft(index: number): AreaDraft {
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

function newBarDraft(): BarDraft {
  return { id: Crypto.randomUUID(), diameter: '12', length: '12', quantity: '' };
}

function newColumnDraft(index: number): ColumnDraft {
  return {
    id: Crypto.randomUUID(),
    name: `עמוד ${index}`,
    count: '1',
    width: '30',
    depth: '30',
    height: '',
    cover: '3',
    longBarCount: '4',
    longBarDiameter: '16',
    stirrupDiameter: '8',
    stirrupSpacing: '20',
  };
}

function reportFromExtraction(e: ExtractionResult): AiExtractionReport {
  return {
    extractedAt: new Date().toISOString(),
    meshes: e.meshes.map((m) => ({
      label:
        `${m.name} — ${m.lengthM}×${m.widthM} מ'` +
        (m.wireDiameterMm > 0 ? ` · Ø${m.wireDiameterMm}@${m.spacingCm}` : ''),
      derivation: m.derivation,
    })),
    bars: e.bars.map((b) => ({
      label: `מוט Ø${b.diameterMm} מ"מ × ${b.lengthM} מ' — ${b.quantity} ${strings.units}`,
      derivation: b.derivation,
    })),
    columns: e.columns.map((c) => ({
      label: `${c.name} × ${c.count} — ${c.widthCm}/${c.depthCm} ס"מ, גובה ${c.heightM} מ'`,
      derivation: c.derivation,
    })),
    notes: e.notes,
  };
}

function parsePositive(text: string): number | null {
  const n = parseNumber(text);
  return n !== null && n > 0 ? n : null;
}

function areasFromDrafts(drafts: AreaDraft[], mesh: MeshSpec): RectArea[] | null {
  const areas: RectArea[] = [];
  for (const d of drafts) {
    const lengthM = parsePositive(d.length);
    const widthM = parsePositive(d.width);
    if (!lengthM || !widthM) return null;
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

function barsFromDrafts(drafts: BarDraft[]): BarItem[] | null {
  const bars: BarItem[] = [];
  for (const d of drafts) {
    const diameterMm = parsePositive(d.diameter);
    const lengthM = parsePositive(d.length);
    const quantity = parsePositive(d.quantity);
    if (!diameterMm || !lengthM || !quantity) return null;
    bars.push({ id: d.id, diameterMm, lengthM, quantity: Math.round(quantity) });
  }
  return bars;
}

function columnsFromDrafts(drafts: ColumnDraft[]): ColumnItem[] | null {
  const columns: ColumnItem[] = [];
  for (const d of drafts) {
    const count = parsePositive(d.count);
    const widthCm = parsePositive(d.width);
    const depthCm = parsePositive(d.depth);
    const heightM = parsePositive(d.height);
    const coverCm = parseNumber(d.cover);
    const longBarCount = parsePositive(d.longBarCount);
    const longBarDiameterMm = parsePositive(d.longBarDiameter);
    const stirrupDiameterMm = parsePositive(d.stirrupDiameter);
    const stirrupSpacingCm = parsePositive(d.stirrupSpacing);
    if (
      !count || !widthCm || !depthCm || !heightM ||
      coverCm === null || coverCm < 0 ||
      !longBarCount || !longBarDiameterMm ||
      !stirrupDiameterMm || !stirrupSpacingCm
    ) {
      return null;
    }
    columns.push({
      id: d.id,
      name: d.name.trim() || 'עמוד',
      count: Math.round(count),
      widthCm,
      depthCm,
      heightM,
      coverCm,
      longBarCount: Math.round(longBarCount),
      longBarDiameterMm,
      stirrupDiameterMm,
      stirrupSpacingCm,
    });
  }
  return columns;
}

export default function PlanOrderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [title, setTitle] = useState('');
  const [overlap, setOverlap] = useState(String(DEFAULT_OVERLAP_CM));
  const [mesh, setMesh] = useState<MeshSpec>(DEFAULT_MESH);
  const [areaDrafts, setAreaDrafts] = useState<AreaDraft[]>([]);
  const [barDrafts, setBarDrafts] = useState<BarDraft[]>([]);
  const [columnDrafts, setColumnDrafts] = useState<ColumnDraft[]>([]);
  const [planFiles, setPlanFiles] = useState<PlanFile[]>([]);
  const [serverUrl, setServerUrlState] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [aiReport, setAiReport] = useState<AiExtractionReport | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [extractProgress, setExtractProgress] = useState('');
  const cancelExtractRef = useRef<(() => void) | null>(null);
  const [existingCreatedAt, setExistingCreatedAt] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showServer, setShowServer] = useState(false);

  useEffect(() => {
    getServerUrl().then(setServerUrlState);
  }, []);

  useEffect(() => {
    if (!id) return;
    getOrder(id).then((order) => {
      if (!order) return;
      setTitle(order.title);
      setOverlap(String(order.overlapCm));
      setExistingCreatedAt(order.createdAt);
      setPlanFiles(orderPlanFiles(order));
      setAiReport(order.aiExtraction ?? null);
      const firstMesh = order.areas[0]?.mesh ?? DEFAULT_MESH;
      setMesh(firstMesh);
      setAreaDrafts(
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
      setBarDrafts(
        (order.bars ?? []).map((b) => ({
          id: b.id,
          diameter: String(b.diameterMm),
          length: String(b.lengthM),
          quantity: String(b.quantity),
        }))
      );
      setColumnDrafts(
        (order.columns ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          count: String(c.count),
          width: String(c.widthCm),
          depth: String(c.depthCm),
          height: String(c.heightM),
          cover: String(c.coverCm),
          longBarCount: String(c.longBarCount),
          longBarDiameter: String(c.longBarDiameterMm),
          stirrupDiameter: String(c.stirrupDiameterMm),
          stirrupSpacing: String(c.stirrupSpacingCm),
        }))
      );
    });
  }, [id]);

  const parsed = useMemo(() => {
    const overlapCm = parseNumber(overlap);
    if (overlapCm === null || overlapCm < 0) return null;
    const areas = areasFromDrafts(areaDrafts, mesh);
    const bars = barsFromDrafts(barDrafts);
    const columns = columnsFromDrafts(columnDrafts);
    if (!areas || !bars || !columns) return null;
    if (areas.length + bars.length + columns.length === 0) return null;
    return { overlapCm, areas, bars, columns };
  }, [areaDrafts, barDrafts, columnDrafts, mesh, overlap]);

  const summary = useMemo(() => {
    if (!parsed) return null;
    try {
      const meshComp = computeOrder(parsed.areas, parsed.overlapCm);
      const extras = computePlanExtras(parsed.bars, parsed.columns);
      const totalSheets = meshComp.lines.reduce((s, l) => s + l.quantity, 0);
      return {
        meshComp,
        extras,
        totalSheets,
        totalBars: extras.barLines.reduce((s, l) => s + l.quantity, 0),
        totalColumns: parsed.columns.reduce((s, c) => s + c.count, 0),
        totalWeightKg: meshComp.totalWeightKg + extras.totalWeightKg,
      };
    } catch (e) {
      if (e instanceof CalcError) return { error: e.message };
      throw e;
    }
  }, [parsed]);

  const pickPlan = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    const name = asset.name ?? 'plan.pdf';
    const ext = name.toLowerCase().split('.').pop() ?? '';

    if (ext !== 'pdf' && ext !== 'dwg' && ext !== 'dxf') {
      notify(strings.unsupportedPlanType);
      return;
    }

    // קובצי CAD מומרים ל-PDF בשרת
    if (ext === 'dwg' || ext === 'dxf') {
      const url = serverUrl.trim();
      if (!url) {
        notify(strings.convertNeedsServer);
        return;
      }
      await setServerUrl(url);
      setConverting(true);
      try {
        const pdfName = name.replace(/\.(dwg|dxf)$/i, '.pdf');
        let destUri = '';
        if (Platform.OS !== 'web') {
          const plansDir = `${FileSystem.documentDirectory}plans/`;
          await FileSystem.makeDirectoryAsync(plansDir, {
            intermediates: true,
          }).catch(() => undefined);
          destUri = `${plansDir}${Crypto.randomUUID()}.pdf`;
        }
        const localUri = await convertCadToPdf(url, asset.uri, name, destUri);
        setPlanFiles((prev) => [...prev, { uri: localUri, name: pdfName }]);
      } catch (e) {
        notify(
          strings.convertFailed,
          e instanceof Error ? e.message : String(e)
        );
      } finally {
        setConverting(false);
      }
      return;
    }

    if (Platform.OS === 'web') {
      setPlanFiles((prev) => [...prev, { uri: asset.uri, name }]);
      return;
    }
    const plansDir = `${FileSystem.documentDirectory}plans/`;
    await FileSystem.makeDirectoryAsync(plansDir, { intermediates: true }).catch(
      () => undefined
    );
    const dest = `${plansDir}${Crypto.randomUUID()}.pdf`;
    await FileSystem.copyAsync({ from: asset.uri, to: dest });
    setPlanFiles((prev) => [...prev, { uri: dest, name }]);
  };

  const openPlan = (uri: string) => {
    if (Platform.OS === 'web') {
      window.open(uri, '_blank');
      return;
    }
    router.push(`/plan-viewer?uri=${encodeURIComponent(uri)}`);
  };

  const applyExtraction = (extraction: ExtractionResult) => {
    if (extraction.meshes.length > 0) {
      setAreaDrafts((prev) => [
        ...prev,
        ...extraction.meshes.map((m, i) => {
          const hasSpec = m.wireDiameterMm > 0 || m.spacingCm > 0;
          return {
            id: Crypto.randomUUID(),
            name: m.name || `${strings.areaDefaultName} ${prev.length + i + 1}`,
            length: String(m.lengthM),
            width: String(m.widthM),
            inherit: !hasSpec,
            overlap: overlap,
            mesh: hasSpec
              ? {
                  ...mesh,
                  wireDiameterMm:
                    m.wireDiameterMm > 0
                      ? m.wireDiameterMm
                      : mesh.wireDiameterMm,
                  spacingCm: m.spacingCm > 0 ? m.spacingCm : mesh.spacingCm,
                }
              : undefined,
          };
        }),
      ]);
    }
    if (extraction.bars.length > 0) {
      setBarDrafts((prev) => [
        ...prev,
        ...extraction.bars.map((b) => ({
          id: Crypto.randomUUID(),
          diameter: String(b.diameterMm),
          length: String(b.lengthM),
          quantity: String(b.quantity),
        })),
      ]);
    }
    if (extraction.columns.length > 0) {
      setColumnDrafts((prev) => [
        ...prev,
        ...extraction.columns.map((c, i) => ({
          id: Crypto.randomUUID(),
          name: c.name || `עמוד ${prev.length + i + 1}`,
          count: String(c.count),
          width: String(c.widthCm),
          depth: String(c.depthCm),
          height: String(c.heightM),
          cover: '3',
          longBarCount: String(c.longBarCount),
          longBarDiameter: String(c.longBarDiameterMm),
          stirrupDiameter: String(c.stirrupDiameterMm),
          stirrupSpacing: String(c.stirrupSpacingCm),
        })),
      ]);
    }
  };

  const extract = async () => {
    if (planFiles.length === 0) {
      notify(strings.extractNeedsPlan);
      return;
    }
    const url = serverUrl.trim();
    if (!url) {
      notify(strings.extractNeedsServer);
      return;
    }
    await setServerUrl(url);
    setExtracting(true);
    setExtractProgress('');
    try {
      const streaming = extractFromPdf(url, planFiles, (text) =>
        setExtractProgress((prev) => prev + text)
      );
      cancelExtractRef.current = streaming.cancel;
      const extraction = await streaming.promise;
      setAiReport(reportFromExtraction(extraction));
      const message =
        strings.extractResult(
          extraction.meshes.length,
          extraction.bars.length,
          extraction.columns.length
        ) + (extraction.notes ? `\n\n${extraction.notes}` : '');
      confirmAction(
        strings.extractResultTitle,
        message,
        strings.extractApply,
        () => {
          applyExtraction(extraction);
          setStep(2);
        }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== 'cancelled') {
        notify(strings.extractFailed, msg);
      }
    } finally {
      cancelExtractRef.current = null;
      setExtracting(false);
    }
  };

  const save = async () => {
    if (!parsed) {
      notify(strings.invalidInput);
      return;
    }
    try {
      const meshComp = computeOrder(parsed.areas, parsed.overlapCm);
      const extras = computePlanExtras(parsed.bars, parsed.columns);
      const order: Order = {
        id: id ?? Crypto.randomUUID(),
        createdAt: existingCreatedAt ?? new Date().toISOString(),
        title: title.trim(),
        overlapCm: parsed.overlapCm,
        areas: parsed.areas,
        results: meshComp.results,
        lines: meshComp.lines,
        totalWeightKg: meshComp.totalWeightKg + extras.totalWeightKg,
        orderType: 'plan',
        bars: parsed.bars,
        barLines: extras.barLines,
        columns: parsed.columns,
        columnResults: extras.columnResults,
        planFiles,
        planFileName: planFiles[0]?.name,
        planFileUri: planFiles[0]?.uri,
        aiExtraction: aiReport ?? undefined,
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
  const validSummary = summary !== null && !('error' in summary) ? summary : null;

  const stepLabels = [
    strings.stepPlan,
    strings.stepQuantities,
    strings.stepSummary,
  ];

  const renderStep1 = () => (
    <>
      <Card title={strings.planSectionTitle}>
        {planFiles.map((f, index) => (
          <View key={`${f.uri}-${index}`} style={styles.fileRow}>
            <Pressable
              hitSlop={6}
              style={styles.fileDelete}
              onPress={() =>
                setPlanFiles((prev) => prev.filter((_, i) => i !== index))
              }
            >
              <Feather name="x" size={16} color={colors.textSecondary} />
            </Pressable>
            <View style={styles.fileTexts}>
              <Text
                style={[typo(type.rowTitle), { color: colors.text }]}
                numberOfLines={1}
              >
                {f.name}
              </Text>
              <Text style={[typo(type.caption), { color: colors.textSecondary }]}>
                PDF
              </Text>
            </View>
            <Pressable onPress={() => openPlan(f.uri)} hitSlop={8}>
              <Text style={[typo({ fontSize: 14, fontWeight: '700' }), { color: colors.primary }]}>
                {strings.viewPlan}
              </Text>
            </Pressable>
            <IconTile icon="file-text" />
          </View>
        ))}
        <Button
          label={strings.attachPlan}
          onPress={pickPlan}
          variant="dashed"
          icon="plus"
          small
          loading={converting}
        />
        <Text style={[typo(type.caption), styles.hint]}>{strings.dwgNote}</Text>
      </Card>

      <GradientCard>
        <View style={styles.heroHeader}>
          <MaterialCommunityIcons
            name="creation"
            size={22}
            color={colors.onPrimary}
          />
          <Text style={[typo({ fontSize: 17, fontWeight: '800' }), { color: colors.onPrimary }]}>
            {strings.aiHeroTitle}
          </Text>
        </View>
        <Text style={[typo(type.body), styles.heroBody]}>
          {strings.aiHeroBody}
        </Text>
        <Pressable
          style={styles.heroButton}
          onPress={extract}
          disabled={extracting}
        >
          <Text style={[typo(type.button), { color: colors.primaryDeep }]}>
            {strings.extractAi}
          </Text>
        </Pressable>
      </GradientCard>

      <Pressable
        style={styles.serverToggle}
        onPress={() => setShowServer((s) => !s)}
      >
        <Feather
          name={showServer ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
        <Text style={[typo(type.secondary), { color: colors.textSecondary }]}>
          {strings.serverSettingsToggle}
        </Text>
      </Pressable>
      {showServer && (
        <Card>
          <Text style={[typo(type.caption), styles.fieldLabel]}>
            {strings.serverUrlLabel}
          </Text>
          <TextInput
            style={[styles.textField, typo(type.body)]}
            value={serverUrl}
            onChangeText={setServerUrlState}
            placeholder={strings.serverUrlPlaceholder}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </Card>
      )}

      <Button
        label={strings.skipManual}
        onPress={() => setStep(2)}
        variant="tonal"
        small
        style={styles.skipBtn}
      />
    </>
  );

  const renderStep2 = () => (
    <>
      {aiReport && (
        <View style={styles.infoBanner}>
          <Text
            style={[
              typo(type.secondary),
              { color: colors.primaryDeep, flex: 1, textAlign: 'right' },
            ]}
          >
            {strings.extractInfoBanner}
          </Text>
          <Pressable onPress={() => setShowReport(true)} hitSlop={8}>
            <Text
              style={[
                typo({ fontSize: 13, fontWeight: '700' }),
                { color: colors.primary, textDecorationLine: 'underline' },
              ]}
            >
              {strings.howCalculated}
            </Text>
          </Pressable>
        </View>
      )}

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
              setAreaDrafts((prev) => [...prev, newAreaDraft(prev.length + 1)])
            }
            hitSlop={8}
          >
            <Text style={[typo({ fontSize: 14, fontWeight: '700' }), { color: colors.primary }]}>
              {strings.addLink}
            </Text>
          </Pressable>
        }
      >
        {areaDrafts.map((d, i) => (
          <RectRow
            key={d.id}
            draft={d}
            onChange={(updated) =>
              setAreaDrafts((prev) =>
                prev.map((x) => (x.id === updated.id ? updated : x))
              )
            }
            onDelete={() =>
              setAreaDrafts((prev) => prev.filter((x) => x.id !== d.id))
            }
            canDelete
            globalMesh={mesh}
            globalOverlapCm={overlap}
            isLast={i === areaDrafts.length - 1}
          />
        ))}
      </Card>

      <Card
        title={strings.barsSectionTitle}
        headerRight={
          <Pressable
            onPress={() => setBarDrafts((prev) => [...prev, newBarDraft()])}
            hitSlop={8}
          >
            <Text style={[typo({ fontSize: 14, fontWeight: '700' }), { color: colors.primary }]}>
              {strings.addLink}
            </Text>
          </Pressable>
        }
      >
        {barDrafts.map((d, i) => (
          <BarRow
            key={d.id}
            draft={d}
            onChange={(updated) =>
              setBarDrafts((prev) =>
                prev.map((x) => (x.id === updated.id ? updated : x))
              )
            }
            onDelete={() =>
              setBarDrafts((prev) => prev.filter((x) => x.id !== d.id))
            }
            isLast={i === barDrafts.length - 1}
          />
        ))}
      </Card>

      <Card
        title={strings.columnsSectionTitle}
        headerRight={
          <Pressable
            onPress={() =>
              setColumnDrafts((prev) => [
                ...prev,
                newColumnDraft(prev.length + 1),
              ])
            }
            hitSlop={8}
          >
            <Text style={[typo({ fontSize: 14, fontWeight: '700' }), { color: colors.primary }]}>
              {strings.addLink}
            </Text>
          </Pressable>
        }
      >
        {columnDrafts.map((d, i) => (
          <ColumnCard
            key={d.id}
            draft={d}
            onChange={(updated) =>
              setColumnDrafts((prev) =>
                prev.map((x) => (x.id === updated.id ? updated : x))
              )
            }
            onDelete={() =>
              setColumnDrafts((prev) => prev.filter((x) => x.id !== d.id))
            }
            isLast={i === columnDrafts.length - 1}
          />
        ))}
      </Card>
    </>
  );

  const renderStep3 = () => (
    <>
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

      {validSummary && (
        <GradientCard>
          <Text style={[typo(type.secondary), styles.heroBody]}>
            {strings.grandTotalWeight}
          </Text>
          <Text style={[typo(type.heroNumber), { color: colors.onPrimary }]}>
            {validSummary.totalWeightKg.toFixed(0)} ק"ג
          </Text>
          <View style={styles.heroPills}>
            {validSummary.totalSheets > 0 && (
              <View style={styles.heroPill}>
                <Text style={[typo(type.secondary), { color: colors.onPrimary }]}>
                  {validSummary.totalSheets} רשתות
                </Text>
              </View>
            )}
            {validSummary.totalBars > 0 && (
              <View style={styles.heroPill}>
                <Text style={[typo(type.secondary), { color: colors.onPrimary }]}>
                  {validSummary.totalBars} מוטות
                </Text>
              </View>
            )}
            {validSummary.totalColumns > 0 && (
              <View style={styles.heroPill}>
                <Text style={[typo(type.secondary), { color: colors.onPrimary }]}>
                  {validSummary.totalColumns} עמודים
                </Text>
              </View>
            )}
          </View>
        </GradientCard>
      )}

      {validSummary && validSummary.meshComp.lines.length > 0 && (
        <Card title={strings.orderLines}>
          {validSummary.meshComp.lines.map((line, i) => (
            <View
              key={i}
              style={[
                styles.denseRow,
                i < validSummary.meshComp.lines.length - 1 &&
                  styles.denseSeparator,
              ]}
            >
              <Text
                style={[typo(type.body), { color: colors.text, flex: 1 }]}
                numberOfLines={1}
              >
                {strings.meshLine(
                  line.mesh.sheetLengthM,
                  line.mesh.sheetWidthM,
                  line.mesh.wireDiameterMm,
                  line.mesh.spacingCm
                )}
              </Text>
              <Text style={[typo(type.secondary), { color: colors.textSecondary }]}>
                ×{line.quantity}
              </Text>
              <Text style={[typo({ fontSize: 14, fontWeight: '700' }), { color: colors.text }]}>
                {line.totalWeightKg.toFixed(0)} ק"ג
              </Text>
            </View>
          ))}
        </Card>
      )}

      {validSummary && validSummary.extras.barLines.length > 0 && (
        <Card title={strings.barLinesTitle}>
          {validSummary.extras.barLines.map((line, i) => (
            <View
              key={i}
              style={[
                styles.denseRow,
                i < validSummary.extras.barLines.length - 1 &&
                  styles.denseSeparator,
              ]}
            >
              <Text style={[typo(type.body), { color: colors.text, flex: 1 }]}>
                מוט Ø{line.diameterMm} × {line.lengthM} מ'
              </Text>
              <Text style={[typo(type.secondary), { color: colors.textSecondary }]}>
                ×{line.quantity}
              </Text>
              <Text style={[typo({ fontSize: 14, fontWeight: '700' }), { color: colors.text }]}>
                {line.totalWeightKg.toFixed(0)} ק"ג
              </Text>
            </View>
          ))}
        </Card>
      )}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{
          title: strings.planOrderTitle,
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

      <View style={styles.stepIndicator}>
        {stepLabels.map((label, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3;
          return (
            <Pressable
              key={label}
              style={styles.stepSegment}
              onPress={() => stepNum < step && setStep(stepNum)}
            >
              <View
                style={[
                  styles.stepBar,
                  stepNum <= step && styles.stepBarActive,
                ]}
              />
              <Text
                style={[
                  typo({ fontSize: 12, fontWeight: stepNum === step ? '700' : '400' }),
                  {
                    color:
                      stepNum <= step ? colors.primary : colors.textTertiary,
                    textAlign: 'center',
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 && (
          <View style={styles.totalRow}>
            <Text style={[typo(type.caption), { color: colors.textSecondary }]}>
              {strings.estimatedTotal}
            </Text>
            <Text style={[typo({ fontSize: 17, fontWeight: '800' }), { color: colors.text }]}>
              {validSummary
                ? strings.liveSummaryPlan(
                    validSummary.totalSheets,
                    validSummary.totalBars,
                    validSummary.totalColumns,
                    validSummary.totalWeightKg
                  )
                : hasError && summary && 'error' in summary
                  ? summary.error
                  : strings.invalidInput}
            </Text>
          </View>
        )}
        {step === 1 && (
          <Button
            label={strings.continueToQuantities}
            onPress={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Button
            label={strings.continueToSummary}
            onPress={() => setStep(3)}
            disabled={validSummary === null}
          />
        )}
        {step === 3 && (
          <Button
            label={strings.saveAndShow}
            onPress={save}
            disabled={validSummary === null}
          />
        )}
      </View>

      {aiReport && (
        <ExtractionReportModal
          visible={showReport}
          report={aiReport}
          orderTitle={title}
          onClose={() => setShowReport(false)}
        />
      )}

      <ExtractionProgressModal
        visible={extracting}
        progressText={extractProgress}
        onCancel={() => cancelExtractRef.current?.()}
      />
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
  stepIndicator: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  stepSegment: {
    flex: 1,
    gap: 6,
  },
  stepBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.chipOutline,
  },
  stepBarActive: {
    backgroundColor: colors.primary,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    marginBottom: spacing.sm,
  },
  fileTexts: {
    flex: 1,
    gap: 2,
  },
  fileDelete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.fillSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroBody: {
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'right',
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  heroButton: {
    backgroundColor: colors.onPrimary,
    borderRadius: 999,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
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
  skipBtn: {
    alignSelf: 'center',
    minWidth: 220,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primaryTint,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  overlapRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  overlapSpacer: {
    flex: 2,
  },
  denseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
  },
  denseSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
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
