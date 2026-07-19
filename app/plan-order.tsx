import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { strings } from '../src/i18n/strings';
import MeshSpecPicker from '../src/components/MeshSpecPicker';
import ExtractionReportModal from '../src/components/ExtractionReportModal';
import ExtractionProgressModal from '../src/components/ExtractionProgressModal';
import RectRow, { AreaDraft } from '../src/components/RectRow';
import BarRow, { BarDraft } from '../src/components/BarRow';
import ColumnCard, { ColumnDraft } from '../src/components/ColumnCard';
import { parseNumber } from '../src/components/NumberField';

function newAreaDraft(index: number): AreaDraft {
  return {
    id: Crypto.randomUUID(),
    name: `${strings.areaDefaultName} ${index}`,
    length: '',
    width: '',
    diameter: '',
    spacing: '',
  };
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
    // שדות ריקים יורשים מהמפרט הכללי של ההזמנה
    const wireDiameterMm = d.diameter.trim()
      ? parsePositive(d.diameter)
      : mesh.wireDiameterMm;
    const spacingCm = d.spacing.trim()
      ? parsePositive(d.spacing)
      : mesh.spacingCm;
    if (!wireDiameterMm || !spacingCm) return null;
    areas.push({
      id: d.id,
      name: d.name.trim() || strings.areaDefaultName,
      lengthM,
      widthM,
      mesh: { ...mesh, wireDiameterMm, spacingCm },
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
  const [customLength, setCustomLength] = useState('');
  const [customWidth, setCustomWidth] = useState('');
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
      if (firstMesh.isCustomSize) {
        setCustomLength(String(firstMesh.sheetLengthM));
        setCustomWidth(String(firstMesh.sheetWidthM));
      }
      setAreaDrafts(
        order.areas.map((a) => ({
          id: a.id,
          name: a.name,
          length: String(a.lengthM),
          width: String(a.widthM),
          diameter:
            a.mesh.wireDiameterMm !== firstMesh.wireDiameterMm
              ? String(a.mesh.wireDiameterMm)
              : '',
          spacing:
            a.mesh.spacingCm !== firstMesh.spacingCm
              ? String(a.mesh.spacingCm)
              : '',
        }))
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
        ...extraction.meshes.map((m, i) => ({
          id: Crypto.randomUUID(),
          name: m.name || `${strings.areaDefaultName} ${prev.length + i + 1}`,
          length: String(m.lengthM),
          width: String(m.widthM),
          diameter: m.wireDiameterMm > 0 ? String(m.wireDiameterMm) : '',
          spacing: m.spacingCm > 0 ? String(m.spacingCm) : '',
        })),
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
        () => applyExtraction(extraction)
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

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen options={{ title: strings.planOrderTitle }} />
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

        <Text style={styles.sectionTitle}>{strings.planSectionTitle}</Text>
        <Text style={styles.hint}>{strings.dwgNote}</Text>
        {planFiles.map((f, index) => (
          <View key={`${f.uri}-${index}`} style={styles.planFileRow}>
            <Pressable
              style={styles.planFileDelete}
              hitSlop={8}
              onPress={() =>
                setPlanFiles((prev) => prev.filter((_, i) => i !== index))
              }
            >
              <Text style={styles.planFileDeleteText}>✕</Text>
            </Pressable>
            <Pressable
              style={styles.planFileMain}
              onPress={() => openPlan(f.uri)}
            >
              <Text style={styles.fileName} numberOfLines={1}>
                {f.name}
              </Text>
              <Text style={styles.planFileView}>{strings.viewPlan}</Text>
            </Pressable>
          </View>
        ))}
        <Pressable
          style={[styles.planBtn, converting && styles.saveDisabled]}
          onPress={pickPlan}
          disabled={converting}
        >
          {converting ? (
            <View style={styles.extractingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.planBtnText}>{strings.convertingCad}</Text>
            </View>
          ) : (
            <Text style={styles.planBtnText}>+ {strings.attachPlan}</Text>
          )}
        </Pressable>

        <Text style={styles.sectionTitle}>{strings.serverSectionTitle}</Text>
        <Text style={styles.label}>{strings.serverUrlLabel}</Text>
        <TextInput
          style={styles.titleInput}
          value={serverUrl}
          onChangeText={setServerUrlState}
          placeholder={strings.serverUrlPlaceholder}
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Pressable
          style={[styles.extractBtn, extracting && styles.saveDisabled]}
          onPress={extract}
          disabled={extracting}
        >
          {extracting ? (
            <View style={styles.extractingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.planBtnText}>{strings.extracting}</Text>
            </View>
          ) : (
            <Text style={styles.planBtnText}>{strings.extractAi}</Text>
          )}
        </Pressable>

        <Text style={styles.sectionTitle}>{strings.overlapLabel}</Text>
        <TextInput
          style={styles.overlapInput}
          value={overlap}
          onChangeText={setOverlap}
          keyboardType="decimal-pad"
        />

        <Text style={styles.sectionTitle}>{strings.meshSectionTitle}</Text>
        <MeshSpecPicker
          value={mesh}
          onChange={setMesh}
          customLength={customLength}
          customWidth={customWidth}
          onCustomLengthChange={setCustomLength}
          onCustomWidthChange={setCustomWidth}
        />

        <Text style={styles.sectionTitle}>{strings.areasSectionTitle}</Text>
        {areaDrafts.map((d) => (
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
            defaultDiameterMm={mesh.wireDiameterMm}
            defaultSpacingCm={mesh.spacingCm}
          />
        ))}
        <Pressable
          style={styles.addButton}
          onPress={() =>
            setAreaDrafts((prev) => [...prev, newAreaDraft(prev.length + 1)])
          }
        >
          <Text style={styles.addButtonText}>+ {strings.addArea}</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>{strings.barsSectionTitle}</Text>
        {barDrafts.map((d) => (
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
          />
        ))}
        <Pressable
          style={styles.addButton}
          onPress={() => setBarDrafts((prev) => [...prev, newBarDraft()])}
        >
          <Text style={styles.addButtonText}>+ {strings.addBar}</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>{strings.columnsSectionTitle}</Text>
        {columnDrafts.map((d) => (
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
          />
        ))}
        <Pressable
          style={styles.addButton}
          onPress={() =>
            setColumnDrafts((prev) => [...prev, newColumnDraft(prev.length + 1)])
          }
        >
          <Text style={styles.addButtonText}>+ {strings.addColumn}</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        {aiReport && (
          <Pressable onPress={() => setShowReport(true)}>
            <Text style={styles.reportLink}>🔍 {strings.aiReportButton}</Text>
          </Pressable>
        )}
        <Text style={styles.summaryText}>
          {summary === null
            ? strings.invalidInput
            : 'error' in summary
              ? summary.error
              : strings.liveSummaryPlan(
                  summary.totalSheets,
                  summary.totalBars,
                  summary.totalColumns,
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
  hint: {
    fontSize: 12,
    color: '#8a6d3b',
    marginBottom: 8,
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
    marginBottom: 6,
    textAlign: 'right',
  },
  planRow: {
    flexDirection: 'row',
    gap: 10,
  },
  planFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#faf8f5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e0d8',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  planFileMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  planFileView: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '600',
  },
  planFileDelete: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f0e8dd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planFileDeleteText: {
    color: '#8a6d3b',
    fontSize: 13,
    fontWeight: '700',
  },
  planBtn: {
    flex: 1,
    backgroundColor: '#b45309',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  planBtnOutline: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#b45309',
  },
  planBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  planBtnOutlineText: {
    color: '#b45309',
  },
  fileName: {
    fontSize: 12,
    color: '#777',
    marginTop: 6,
    textAlign: 'right',
  },
  extractBtn: {
    backgroundColor: '#7c3f00',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  extractingRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
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
  reportLink: {
    color: '#7c3f00',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    textDecorationLine: 'underline',
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
