import { CheckCircle, AlertTriangle, TrendingUp, FlaskConical } from 'lucide-react';
import { FertilizerRecommendation } from '../../types';
import { classifyMoisture, classifyPh, toneClasses } from '../../utils/soilAnalysis';

interface RecommendationCardProps {
  recommendation: FertilizerRecommendation;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const getDosageBandColor = (band: string) => {
    switch (band) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg shadow-xl p-8 border-2 border-green-300">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bold text-gray-900">Recommendation</h2>
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>

      {(() => {
        const s = recommendation.sensorData;
        const pc = s.ph !== undefined ? classifyPh(s.ph) : null;
        const mc = classifyMoisture(s.moisture);
        return (
          <div className="flex flex-wrap items-center gap-2 mb-6 text-sm">
            <span className="text-gray-600">Based on:</span>
            {pc && (
              <span className={`px-2 py-1 rounded font-semibold ${toneClasses[pc.tone]}`}>
                pH {s.ph!.toFixed(2)} · {pc.label}
              </span>
            )}
            <span className={`px-2 py-1 rounded font-semibold ${toneClasses[mc.tone]}`}>
              Moisture {s.moisture.toFixed(0)} % · {mc.label}
            </span>
            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 capitalize">
              {recommendation.manualInputs.cropType} · {recommendation.manualInputs.soilType} soil
            </span>
            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">{s.source === 'demo' ? 'demo data' : 'live analyzer'}</span>
          </div>
        );
      })()}

      <div className="bg-white rounded-lg p-6 mb-6 border-2 border-green-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Recommended Fertilizer</p>
            <h3 className="text-3xl font-bold text-green-700">{recommendation.fertilizerType}</h3>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 mb-1" title="How complete the inputs were: pH measured + N, P, K entered">
              Data confidence
            </p>
            <p className={`text-3xl font-bold ${getConfidenceColor(recommendation.confidence)}`}>
              {recommendation.confidence}%
            </p>
            {recommendation.confidence < 70 && <p className="text-xs text-gray-500">Add soil N-P-K to improve</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Dosage Band</p>
            <span
              className={`inline-block px-4 py-2 rounded-lg border-2 font-bold text-lg ${getDosageBandColor(
                recommendation.dosageBand
              )}`}
            >
              {recommendation.dosageBand.toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Dosage Amount</p>
            <p className="text-lg font-bold text-gray-900">{recommendation.dosageAmount}</p>
          </div>
        </div>
      </div>

      {recommendation.amendment && (
        <div
          className={`rounded-lg p-6 mb-6 border-2 ${
            recommendation.amendment.action === 'none' ? 'bg-white border-green-200' : 'bg-amber-50 border-amber-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical className="w-5 h-5 text-amber-700" />
            <h4 className="text-lg font-bold text-gray-900">pH correction</h4>
          </div>
          {recommendation.amendment.action === 'none' ? (
            <p className="text-gray-700 text-lg">{recommendation.amendment.note}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 mb-2">
                <p className="text-2xl font-bold text-amber-900">
                  ≈ {recommendation.amendment.amountKgPerAcre} kg/acre
                </p>
                <p className="text-lg font-semibold text-gray-800">{recommendation.amendment.product}</p>
                <p className="text-gray-600">target pH {recommendation.amendment.targetPh}</p>
              </div>
              <p className="text-gray-700">{recommendation.amendment.note}</p>
              <p className="text-xs text-gray-500 mt-2">
                Rough estimate from soil texture. Confirm with a lab lime/sulfur requirement test before buying large amounts.
              </p>
            </>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg p-6 mb-6 border-2 border-blue-200">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h4 className="text-lg font-bold text-gray-900">Application Timing</h4>
        </div>
        <p className="text-gray-700 text-lg">{recommendation.applicationTiming}</p>
      </div>

      <div className="bg-white rounded-lg p-6 mb-6 border-2 border-gray-200">
        <h4 className="text-lg font-bold text-gray-900 mb-3">Why This Recommendation?</h4>
        <p className="text-gray-700 text-lg leading-relaxed">{recommendation.reason}</p>
      </div>

      {recommendation.warnings && recommendation.warnings.length > 0 && (
        <div className="bg-yellow-50 rounded-lg p-6 border-2 border-yellow-300">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-yellow-700" />
            <h4 className="text-lg font-bold text-yellow-900">Important Warnings</h4>
          </div>
          <ul className="space-y-2">
            {recommendation.warnings.map((warning, index) => (
              <li key={index} className="text-yellow-800 text-lg flex items-start gap-2">
                <span className="text-yellow-600 mt-1">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-500 text-right">
        Generated: {recommendation.timestamp.toLocaleString()}
      </div>
    </div>
  );
}
