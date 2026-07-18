import { MeshSpec } from './types';

export interface PresetSheet {
  sheetLengthM: number;
  sheetWidthM: number;
}

export const PRESET_SHEETS: PresetSheet[] = [
  { sheetLengthM: 3, sheetWidthM: 2 },
  { sheetLengthM: 4, sheetWidthM: 2 },
  { sheetLengthM: 5, sheetWidthM: 2 },
  { sheetLengthM: 2, sheetWidthM: 1 },
];

export const DIAMETERS_MM = [5.5, 6, 8, 10, 12];

export const SPACINGS_CM = [10, 15, 20];

export const DEFAULT_OVERLAP_CM = 30;

export const DEFAULT_MESH: MeshSpec = {
  sheetLengthM: 3,
  sheetWidthM: 2,
  wireDiameterMm: 8,
  spacingCm: 20,
  isCustomSize: false,
};
