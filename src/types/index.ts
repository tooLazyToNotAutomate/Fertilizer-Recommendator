export type CropType =
  | 'rice'
  | 'wheat'
  | 'maize'
  | 'cotton'
  | 'sugarcane'
  | 'soybean'
  | 'groundnut'
  | 'tomato'
  | 'potato'
  | 'onion'
  | 'chili';

export type SoilType =
  | 'sandy'
  | 'loamy'
  | 'clay'
  | 'silt'
  | 'peaty'
  | 'chalky'
  | 'red'
  | 'black'
  | 'alluvial';

/**
 * One line from the Smart Soil Analyzer firmware (hardware/firmware/soil_analyzer, v1.0).
 * pH and moisture are real, calibrated measurements. The build has NO temperature or
 * humidity sensor: the firmware sends fixed placeholders (25 °C / 60 %), which the app
 * ignores. It fills temperature/humidity from online weather instead (utils/weather.ts).
 * `ph` is missing while the probe is out of liquid (the reading would be noise).
 */
export interface ArduinoData {
  ph?: number;
  moisture: number;
  temperature?: number; // °C, from online weather
  humidity?: number; // %, from online weather
  // diagnostics sent by the firmware (absent in demo data from older sketches)
  fw?: number;            // firmware version x10 (10 = v1.0)
  probe?: 0 | 1;          // 1 = pH probe in liquid, reading valid
  ph_final?: 0 | 1;       // 1 = calibration from buffers, 0 = estimate
  po?: number;            // pH board output voltage
  vcc?: number;           // measured 5 V supply
  noise_mv?: number;      // spread within one pH reading
  raw_ph?: number;
  raw_moisture?: number;
  lcd_resets?: number;
  i2c_timeouts?: number;
}

export type DataSource = 'arduino' | 'demo';

/** How trustworthy one reading is (about the SENSOR, not the soil). */
export type SensorQuality = 'good' | 'fair' | 'poor';

export interface SensorReading extends ArduinoData {
  timestamp: Date;
  quality: SensorQuality;
  source: DataSource;
}

export interface ManualInputs {
  cropType: string;
  soilType: string;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  rainfall?: number;
}

export interface FertilizerRecommendation {
  id: string;
  fertilizerType: string;
  dosageBand: 'low' | 'medium' | 'high';
  dosageAmount: string;
  applicationTiming: string;
  reason: string;
  confidence: number;
  warnings?: string[];
  amendment?: PhAmendment;
  timestamp: Date;
  sensorData: SensorReading;
  manualInputs: ManualInputs;
}

/** Lime / sulfur estimate to move soil pH into the crop's preferred range. */
export interface PhAmendment {
  action: 'lime' | 'sulfur' | 'none';
  product: string;
  targetPh: number;
  amountKgPerAcre: number;
  note: string;
}

export interface ConnectionStatus {
  connected: boolean;
  portName?: string;
  error?: string;
  lastUpdate?: Date;
}
