import { FertilizerRecommendation, SensorReading } from '../types';

function download(filename: string, rows: (string | number | undefined)[][]) {
  const esc = (v: string | number | undefined) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

export function exportSensorCsv(history: SensorReading[]) {
  download(`soil-readings-${stamp()}.csv`, [
    ['time', 'source', 'ph', 'moisture_pct', 'sensor_quality', 'probe_in_liquid', 'po_volts', 'vcc_volts', 'noise_mv', 'temperature_assumed_c', 'humidity_assumed_pct'],
    ...history.map((r) => [
      r.timestamp.toISOString(),
      r.source,
      r.ph?.toFixed(2),
      r.moisture,
      r.quality,
      r.probe ?? (r.ph !== undefined ? 1 : 0),
      r.po,
      r.vcc,
      r.noise_mv,
      r.temperature,
      r.humidity
    ])
  ]);
}

export function exportRecommendationsCsv(recs: FertilizerRecommendation[]) {
  download(`fertilizer-recommendations-${stamp()}.csv`, [
    ['time', 'crop', 'soil_type', 'ph', 'moisture_pct', 'n', 'p', 'k', 'fertilizer', 'dose', 'dosage_band', 'ph_correction', 'correction_kg_per_acre', 'data_confidence_pct', 'reason'],
    ...recs.map((r) => [
      r.timestamp.toISOString(),
      r.manualInputs.cropType,
      r.manualInputs.soilType,
      r.sensorData.ph?.toFixed(2),
      r.sensorData.moisture,
      r.manualInputs.nitrogen,
      r.manualInputs.phosphorus,
      r.manualInputs.potassium,
      r.fertilizerType,
      r.dosageAmount,
      r.dosageBand,
      r.amendment?.product,
      r.amendment?.amountKgPerAcre,
      r.confidence,
      r.reason
    ])
  ]);
}
