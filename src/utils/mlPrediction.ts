import { ArduinoData, ManualInputs } from '../types';
import { CROP_PH_RANGE } from './soilAnalysis';

/**
 * Fertilizer choice + dose.
 *
 * Default: a transparent rule-based engine that runs in the browser (works on the
 * hosted site with no server). It compares the crop's N-P-K requirement with the soil
 * values the farmer typed in, and uses the measured pH to pick suitable products.
 *
 * Optional: set VITE_USE_BACKEND=1 to ask the Python service (/_/backend/predict) first.
 * (Its model is still trained on a tiny synthetic set, so it is off by default.)
 */

export interface MLPrediction {
  fertilizerType: string;
  confidence: number;
  dosageBand: 'low' | 'medium' | 'high';
  dosageAmount: string;
  reason: string;
}

/** Crop requirement in kg of nutrient (N, P, K) per acre per season. */
export const CROP_NPK: Record<string, { n: number; p: number; k: number }> = {
  rice: { n: 80, p: 40, k: 40 },
  wheat: { n: 120, p: 60, k: 40 },
  maize: { n: 150, p: 75, k: 75 },
  cotton: { n: 100, p: 50, k: 50 },
  sugarcane: { n: 200, p: 80, k: 100 },
  soybean: { n: 40, p: 60, k: 40 },
  groundnut: { n: 25, p: 50, k: 75 },
  tomato: { n: 100, p: 80, k: 100 },
  potato: { n: 120, p: 60, k: 120 },
  onion: { n: 100, p: 50, k: 100 },
  chili: { n: 100, p: 50, k: 50 }
};

// nutrient fraction in each product (simplified: P and K counted as the element given on the bag)
const PRODUCTS = {
  Urea: { n: 0.46, p: 0, k: 0 },
  DAP: { n: 0.18, p: 0.46, k: 0 },
  SSP: { n: 0, p: 0.16, k: 0 },
  MOP: { n: 0, p: 0, k: 0.6 },
  'NPK 10-26-26': { n: 0.1, p: 0.26, k: 0.26 },
  'NPK 14-35-14': { n: 0.14, p: 0.35, k: 0.14 },
  'NPK 19-19-19': { n: 0.19, p: 0.19, k: 0.19 }
} as const;

const band = (kg: number): 'low' | 'medium' | 'high' => (kg < 75 ? 'low' : kg < 175 ? 'medium' : 'high');

export class MLModel {
  async predictFertilizer(sensorData: ArduinoData, manualInputs: ManualInputs): Promise<MLPrediction> {
    if (import.meta.env.VITE_USE_BACKEND === '1') {
      const fromBackend = await this.tryBackend(sensorData, manualInputs);
      if (fromBackend) return fromBackend;
    }
    return this.ruleBased(sensorData, manualInputs);
  }

  private ruleBased(sensorData: ArduinoData, m: ManualInputs): MLPrediction {
    const crop = m.cropType in CROP_NPK ? m.cropType : 'rice';
    const req = CROP_NPK[crop];
    const ph = sensorData.ph ?? 7;
    const [phLo, phHi] = CROP_PH_RANGE[crop] ?? [6.0, 7.5];
    const npkKnown = m.nitrogen !== undefined || m.phosphorus !== undefined || m.potassium !== undefined;

    // without a soil test we can only follow the crop's standard (balanced) need at a moderate rate
    if (!npkKnown) {
      // basal complex sized to the crop's phosphorus need, the rest of the nitrogen as urea in splits
      const product = ph > 7.5 ? 'NPK 14-35-14' : 'NPK 19-19-19';
      const f = PRODUCTS[product];
      const kg = Math.round(req.p / f.p / 5) * 5;
      const nLeft = Math.max(0, req.n - kg * f.n);
      const urea = Math.round(nLeft / PRODUCTS.Urea.n / 5) * 5;
      return {
        fertilizerType: product,
        dosageBand: band(kg),
        dosageAmount: `${kg} kg/acre basal${urea ? ` + Urea ${urea} kg/acre in splits` : ''}`,
        confidence: sensorData.ph !== undefined ? 60 : 55,
        reason:
          `No N-P-K soil values were entered, so this follows the standard ${crop} requirement ` +
          `(${req.n}-${req.p}-${req.k} kg/acre N-P-K). ${kg} kg of ${product} covers the phosphorus` +
          `${product === 'NPK 19-19-19' ? ' and potassium' : ''} need and ${Math.round(kg * f.n)} kg of nitrogen; ` +
          `${urea ? `${urea} kg Urea supplies the remaining ${Math.round(nLeft)} kg N.` : 'no extra nitrogen is needed.'}` +
          (ph > 7.5 ? ' A phosphorus-rich complex is chosen because phosphorus is less available in alkaline soil.' : '') +
          ' Enter soil-test N, P and K for a precise dose.'
      };
    }

    const gap = {
      n: Math.max(0, req.n - (m.nitrogen ?? req.n)),
      p: Math.max(0, req.p - (m.phosphorus ?? req.p)),
      k: Math.max(0, req.k - (m.potassium ?? req.k))
    };
    const rel = { n: gap.n / req.n, p: gap.p / req.p, k: gap.k / req.k };
    const big = (Object.keys(rel) as ('n' | 'p' | 'k')[]).filter((x) => rel[x] >= 0.25);

    let product: keyof typeof PRODUCTS | 'Organic manure (FYM/compost)' = 'NPK 19-19-19';
    let kg = 0;
    let why = '';
    if (big.length === 0) {
      product = 'Organic manure (FYM/compost)';
      kg = 2000;
      why = 'Soil N, P and K are within 25 % of the crop requirement, so only organic matter for soil health is suggested.';
    } else if (big.length >= 2 && big.includes('p') && big.includes('k')) {
      product = 'NPK 10-26-26';
      kg = Math.max(gap.p / PRODUCTS[product].p, gap.k / PRODUCTS[product].k);
      why = `Phosphorus and potassium are both short (P −${gap.p}, K −${gap.k} kg/acre).`;
    } else if (big.length >= 2) {
      product = 'NPK 14-35-14';
      kg = gap.p > 0 ? gap.p / PRODUCTS[product].p : gap.n / PRODUCTS[product].n;
      why = `Several nutrients are short (N −${gap.n}, P −${gap.p}, K −${gap.k} kg/acre).`;
    } else {
      const only = big[0];
      if (only === 'n') {
        product = 'Urea';
        kg = gap.n / PRODUCTS.Urea.n;
        why = `Nitrogen is the main shortfall (−${gap.n} kg/acre).`;
      } else if (only === 'p') {
        // SSP adds sulfur and is mildly acidifying: better on alkaline soil
        product = ph > 7.5 ? 'SSP' : 'DAP';
        kg = gap.p / PRODUCTS[product].p;
        why = `Phosphorus is the main shortfall (−${gap.p} kg/acre).` + (ph > 7.5 ? ' SSP is preferred on alkaline soil.' : '');
      } else {
        product = 'MOP';
        kg = gap.k / PRODUCTS.MOP.k;
        why = `Potassium is the main shortfall (−${gap.k} kg/acre).`;
      }
    }
    kg = Math.round(kg / 5) * 5;

    // a complex fertilizer sized for P/K rarely covers nitrogen: top up the rest with urea
    let ureaTopUp = 0;
    if (product in PRODUCTS && product !== 'Urea') {
      const nSupplied = kg * PRODUCTS[product as keyof typeof PRODUCTS].n;
      const nLeft = gap.n - nSupplied;
      if (nLeft > 10) {
        ureaTopUp = Math.round(nLeft / PRODUCTS.Urea.n / 5) * 5;
        why += ` It supplies ${Math.round(nSupplied)} kg N, so ${ureaTopUp} kg Urea is added for the remaining nitrogen (apply in splits).`;
      }
    }

    const phNote =
      ph < phLo
        ? ` Soil pH ${ph.toFixed(2)} is below the ${crop} range (${phLo}–${phHi}); correct it with lime, or nutrients stay locked up.`
        : ph > phHi
        ? ` Soil pH ${ph.toFixed(2)} is above the ${crop} range (${phLo}–${phHi}); see the pH correction below.`
        : ` Soil pH ${ph.toFixed(2)} suits ${crop}.`;

    // confidence = how complete the inputs are (not a model probability)
    const entered = [m.nitrogen, m.phosphorus, m.potassium].filter((v) => v !== undefined).length;
    const confidence = Math.min(90, 55 + entered * 10 + (sensorData.ph !== undefined ? 5 : 0));

    return {
      fertilizerType: product,
      dosageBand: product.startsWith('Organic') ? 'medium' : band(kg + ureaTopUp),
      dosageAmount: product.startsWith('Organic')
        ? '2 t/acre (2000 kg)'
        : `${kg} kg/acre${ureaTopUp ? ` + Urea ${ureaTopUp} kg/acre` : ''}`,
      confidence,
      reason: why + phNote
    };
  }

  private async tryBackend(sensorData: ArduinoData, m: ManualInputs): Promise<MLPrediction | null> {
    try {
      const response = await fetch('/_/backend/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ph: sensorData.ph,
          moisture: sensorData.moisture,
          temperature: sensorData.temperature,
          humidity: sensorData.humidity,
          nitrogen: m.nitrogen ?? 50,
          phosphorus: m.phosphorus ?? 50,
          potassium: m.potassium ?? 50,
          crop_type: m.cropType,
          soil_type: m.soilType
        })
      });
      if (!response.ok) return null;
      const r = await response.json();
      return {
        fertilizerType: r.fertilizer_type,
        confidence: Math.round(r.confidence * 100),
        dosageBand: r.dosage_band,
        dosageAmount: r.dosage_amount,
        reason: r.reason
      };
    } catch {
      return null;
    }
  }
}
