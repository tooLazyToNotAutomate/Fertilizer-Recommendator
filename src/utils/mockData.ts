import { ArduinoData } from '../types';
import { PROTOTYPE } from './soilAnalysis';

/**
 * Demo mode: simulates the real prototype with the three exhibition jars.
 * Values drift slowly around each sample like the real probe does, and the
 * line looks like the firmware's JSON (fixed assumed temperature/humidity).
 */
export const DEMO_SAMPLES = {
  A: { name: 'Jar A · Red sandy soil', ph: 5.9, moisture: 38 },
  B: { name: 'Jar B · Black cotton soil', ph: 8.1, moisture: 55 },
  C: { name: 'Jar C · Brown loamy soil', ph: 6.9, moisture: 47 }
} as const;
export type DemoSampleId = keyof typeof DEMO_SAMPLES;

export class MockDataGenerator {
  private intervalId: number | null = null;
  private onDataCallback: ((data: ArduinoData) => void) | null = null;
  private sample: DemoSampleId = 'C';
  private ph = DEMO_SAMPLES.C.ph;
  private moisture = DEMO_SAMPLES.C.moisture;

  onData(callback: (data: ArduinoData) => void) {
    this.onDataCallback = callback;
  }

  setSample(id: DemoSampleId) {
    this.sample = id;
  }

  getSample(): DemoSampleId {
    return this.sample;
  }

  start(intervalMs: number = 1000) {
    if (this.intervalId) return;
    this.intervalId = window.setInterval(() => this.tick(), intervalMs);
    this.tick();
  }

  private tick() {
    const target = DEMO_SAMPLES[this.sample];
    // move ~25 % of the way to the sample each second (like the probe settling), plus small noise
    this.ph += (target.ph - this.ph) * 0.25 + (Math.random() - 0.5) * 0.02;
    this.moisture += (target.moisture - this.moisture) * 0.25 + (Math.random() - 0.5) * 0.6;
    const ph = +this.ph.toFixed(2);
    const data: ArduinoData = {
      ph,
      moisture: Math.round(Math.min(100, Math.max(0, this.moisture))),
      temperature: PROTOTYPE.assumedTempC,
      humidity: PROTOTYPE.assumedHumidity,
      fw: 10,
      probe: 1,
      ph_final: 1,
      po: +(PROTOTYPE.ph.v7 - (ph - 7) * PROTOTYPE.ph.slopeVPerPh).toFixed(3),
      vcc: 5.26,
      noise_mv: Math.round(15 + Math.random() * 15)
    };
    this.onDataCallback?.(data);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
