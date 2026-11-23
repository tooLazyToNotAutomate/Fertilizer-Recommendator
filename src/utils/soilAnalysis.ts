import { ArduinoData, DataSource, PhAmendment, SensorQuality } from '../types';

/* ------------------------------------------------------------------ *
 * Soil interpretation shared by the cards, charts and recommendations.
 * pH classes match the firmware's LCD text (hardware/firmware/soil_analyzer).
 * All amendment amounts are ROUGH field estimates: confirm with a soil lab
 * buffer-pH (lime requirement) test before buying large quantities.
 * ------------------------------------------------------------------ */

export const PROTOTYPE = {
  firmware: 'soil_analyzer v1.0',
  calibratedOn: '2026-11-21',
  ph: { v7: 2.5058, slopeVPerPh: 0.1828, buffers: '4.00 / 7.00 / 10.01', accuracy: '±0.05 pH' },
  moisture: { airRaw: 592, waterRaw: 323 } // air re-measured 2026-11-23
};

export interface PhClass {
  label: string;
  tone: 'red' | 'orange' | 'green' | 'blue' | 'purple';
}

export function classifyPh(ph: number): PhClass {
  if (ph < 5.5) return { label: 'Strongly acidic', tone: 'red' };
  if (ph < 6.5) return { label: 'Acidic', tone: 'orange' };
  if (ph <= 7.5) return { label: 'Neutral', tone: 'green' };
  if (ph <= 8.5) return { label: 'Alkaline', tone: 'blue' };
  return { label: 'Strongly alkaline', tone: 'purple' };
}

/** Moisture % is calibrated 0 % = sensor in air, 100 % = sensor in water. */
export function classifyMoisture(m: number): PhClass {
  if (m < 20) return { label: 'Dry', tone: 'red' };
  if (m < 40) return { label: 'Low', tone: 'orange' };
  if (m <= 70) return { label: 'Good', tone: 'green' };
  if (m <= 85) return { label: 'Wet', tone: 'blue' };
  return { label: 'Saturated', tone: 'purple' };
}

/** Sensor trust, from the firmware's own diagnostics (not from the soil value). */
export function assessSensorQuality(d: ArduinoData, source: DataSource): SensorQuality {
  if (source === 'demo') return 'good';
  if (d.probe === 0 || d.ph === undefined) return 'poor';
  if (d.fw === undefined) return 'fair'; // older sketch: no diagnostics to judge by
  const vccOk = d.vcc === undefined || (d.vcc >= 4.6 && d.vcc <= 5.3);
  if (!vccOk || (d.noise_mv ?? 0) > 60 || d.ph_final === 0) return 'fair';
  return 'good';
}

/** Preferred soil pH range per crop (common agronomy references). */
export const CROP_PH_RANGE: Record<string, [number, number]> = {
  rice: [5.5, 6.5],
  wheat: [6.0, 7.5],
  maize: [5.8, 7.0],
  cotton: [5.8, 8.0],
  sugarcane: [6.0, 7.5],
  soybean: [6.0, 7.0],
  groundnut: [6.0, 6.5],
  tomato: [6.0, 6.8],
  potato: [5.0, 6.5],
  onion: [6.0, 7.0],
  chili: [6.0, 7.0]
};

// kg per acre to move the top ~15 cm by ONE pH unit (rough, by texture)
const LIME_KG_PER_UNIT: Record<string, number> = {
  sandy: 450, red: 550, silt: 700, loamy: 800, alluvial: 800, clay: 1200, black: 1300
};
const SULFUR_KG_PER_UNIT: Record<string, number> = {
  sandy: 90, red: 110, silt: 140, loamy: 150, alluvial: 150, clay: 200, black: 220
};

export function phAmendment(ph: number, cropType: string, soilType: string): PhAmendment {
  const [lo, hi] = CROP_PH_RANGE[cropType] ?? [6.0, 7.5];
  const soil = soilType in LIME_KG_PER_UNIT ? soilType : 'loamy';

  if (ph < lo) {
    const target = Math.min(hi, lo + 0.3);
    const amount = Math.round(((target - ph) * LIME_KG_PER_UNIT[soil]) / 10) * 10;
    return {
      action: 'lime',
      product: 'Agricultural lime (CaCO₃)',
      targetPh: +target.toFixed(1),
      amountKgPerAcre: amount,
      note: `Raises pH from ${ph.toFixed(2)} toward ${target.toFixed(1)}. Spread evenly and mix into the top soil 2–3 weeks before sowing; ${amount > 1000 ? 'split into two applications (6 months apart). ' : ''}re-test after 3 months.`
    };
  }
  if (ph > hi) {
    const target = Math.max(lo, hi - 0.3);
    const amount = Math.round(((ph - target) * SULFUR_KG_PER_UNIT[soil]) / 5) * 5;
    const calcareous = soil === 'black' || ph >= 8.3;
    return {
      action: 'sulfur',
      product: 'Elemental sulfur (S)',
      targetPh: +target.toFixed(1),
      amountKgPerAcre: amount,
      note:
        `Lowers pH from ${ph.toFixed(2)} toward ${target.toFixed(1)} over 2–6 months (soil bacteria turn S into acid). ` +
        (calcareous
          ? 'Black cotton / calcareous soils contain free lime that neutralises the acid, so sulfur may barely move the pH. Prefer acid-forming fertilizers (ammonium sulfate), organic manure, and use gypsum only if the soil is sodic.'
          : 'Apply no more than ~200 kg/acre at once; re-test before adding more.')
    };
  }
  return {
    action: 'none',
    product: 'No pH correction needed',
    targetPh: +ph.toFixed(1),
    amountKgPerAcre: 0,
    note: `pH ${ph.toFixed(2)} is inside the preferred range for ${cropType} (${lo}–${hi}).`
  };
}

/** Which nutrients become hard for roots to take up at this pH. */
export function nutrientAvailabilityNotes(ph: number): string[] {
  if (ph < 5.5)
    return ['At this acidity phosphorus, calcium, magnesium and molybdenum are poorly available, and aluminium/manganese can become toxic.'];
  if (ph < 6.0) return ['Phosphorus availability starts to drop below pH 6.0.'];
  if (ph > 8.0)
    return ['Above pH 8, phosphorus, iron, zinc, manganese and boron are poorly available. Micronutrient (Zn/Fe) foliar sprays may be needed.'];
  if (ph > 7.5) return ['Iron and zinc availability starts to drop above pH 7.5.'];
  return [];
}

export const toneClasses: Record<PhClass['tone'], string> = {
  red: 'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800'
};
