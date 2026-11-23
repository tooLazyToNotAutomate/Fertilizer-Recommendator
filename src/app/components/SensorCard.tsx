import { Activity, Droplet, Thermometer, Wind } from 'lucide-react';
import { PhClass, toneClasses } from '../../utils/soilAnalysis';

interface SensorCardProps {
  label: string;
  value: number | undefined;
  unit: string;
  icon: 'ph' | 'moisture' | 'temperature' | 'humidity';
  decimals?: number;
  /** soil interpretation, e.g. "Acidic" */
  status?: PhClass;
  /** small grey line under the value, e.g. "Assumed – no sensor" */
  note?: string;
  /** grey the card out (value is not measured) */
  muted?: boolean;
  /** shown instead of "--" when there is no value */
  emptyText?: string;
}

export function SensorCard({ label, value, unit, icon, decimals = 1, status, note, muted, emptyText }: SensorCardProps) {
  const Icon = { ph: Activity, moisture: Droplet, temperature: Thermometer, humidity: Wind }[icon];

  return (
    <div
      className={`rounded-lg shadow-md p-6 border-2 ${
        muted ? 'bg-gray-50 border-dashed border-gray-300' : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-600 text-lg">{label}</span>
        <Icon className={`w-8 h-8 ${muted ? 'text-gray-300' : 'text-green-600'}`} />
      </div>
      <div className="flex items-baseline min-h-[2.5rem]">
        {value !== undefined ? (
          <>
            <span className={`text-4xl font-bold ${muted ? 'text-gray-400' : 'text-gray-900'}`}>
              {value.toFixed(decimals)}
            </span>
            {unit && <span className="ml-2 text-xl text-gray-500">{unit}</span>}
          </>
        ) : (
          <span className="text-lg text-gray-400">{emptyText ?? '--'}</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 min-h-[1.75rem]">
        {status && value !== undefined && (
          <span className={`text-sm px-2 py-1 rounded font-semibold ${toneClasses[status.tone]}`}>{status.label}</span>
        )}
        {note && <span className="text-xs text-gray-500">{note}</span>}
      </div>
    </div>
  );
}
