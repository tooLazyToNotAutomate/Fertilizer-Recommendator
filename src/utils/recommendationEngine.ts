import { FertilizerRecommendation, ManualInputs, SensorReading } from '../types';
import { MLModel } from './mlPrediction';
import { classifyMoisture, nutrientAvailabilityNotes, phAmendment } from './soilAnalysis';

export class RecommendationEngine {
  private mlModel = new MLModel();

  async generateRecommendation(
    sensorData: SensorReading,
    manualInputs: ManualInputs
  ): Promise<FertilizerRecommendation> {
    if (sensorData.ph === undefined) {
      throw new Error('No pH reading: dip the probe in the soil slurry first.');
    }
    const { ph, moisture } = sensorData;
    const { cropType } = manualInputs;

    const prediction = await this.mlModel.predictFertilizer(sensorData, manualInputs);
    const amendment = phAmendment(ph, cropType, manualInputs.soilType);

    const warnings: string[] = [];
    if (amendment.action === 'lime')
      warnings.push(`Soil is too acidic for ${cropType}: apply about ${amendment.amountKgPerAcre} kg/acre of agricultural lime (see pH correction).`);
    if (amendment.action === 'sulfur')
      warnings.push(`Soil is too alkaline for ${cropType}: see the pH correction (elemental sulfur) below.`);
    warnings.push(...nutrientAvailabilityNotes(ph));

    const mc = classifyMoisture(moisture);
    if (mc.label === 'Dry') warnings.push('Soil is dry. Irrigate before applying fertilizer so it can dissolve and reach the roots.');
    if (mc.label === 'Saturated') warnings.push('Soil is saturated. Wait for it to drain; applying now risks nutrients washing away.');
    if (manualInputs.rainfall && manualInputs.rainfall > 50)
      warnings.push('Heavy recent rainfall. Delay application to avoid run-off.');
    if (sensorData.quality === 'fair')
      warnings.push('Sensor reading quality is only fair (see Device status). Re-check pH in buffer 7.00 if results look wrong.');

    let applicationTiming = 'Apply in two split doses: 50% at sowing, 50% after 30 days.';
    if (cropType === 'rice')
      applicationTiming = 'Basal dose at puddling, then top-dress at tillering and panicle initiation.';
    else if (cropType === 'wheat')
      applicationTiming = 'Apply 1/3 of the nitrogen and all P & K at sowing; the remaining nitrogen after the first irrigation.';
    else if (cropType === 'maize')
      applicationTiming = 'Apply 25% N at sowing, 50% at knee-high stage and 25% at tasselling.';
    if (amendment.action === 'lime')
      applicationTiming = 'Apply lime 2–3 weeks BEFORE fertilizer (never mix lime with urea/DAP). ' + applicationTiming;

    return {
      id: Math.random().toString(36).slice(2, 11),
      fertilizerType: prediction.fertilizerType,
      dosageBand: prediction.dosageBand,
      dosageAmount: prediction.dosageAmount,
      applicationTiming,
      reason: prediction.reason,
      confidence: prediction.confidence,
      warnings: warnings.length > 0 ? warnings : undefined,
      amendment,
      timestamp: new Date(),
      sensorData,
      manualInputs
    };
  }
}
