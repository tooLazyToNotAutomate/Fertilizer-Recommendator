import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { SensorReading } from '../../types';

interface SensorTrendChartProps {
  data: SensorReading[];
  maxPoints?: number;
  /** preferred pH band for the selected crop, shaded on the pH chart */
  phBand?: [number, number];
}

export function SensorTrendChart({ data, maxPoints = 30, phBand = [6.0, 7.5] }: SensorTrendChartProps) {
  const chartData = data.slice(-maxPoints).map((r) => ({
    time: r.timestamp.toLocaleTimeString(),
    pH: r.ph ?? null, // gap in the line while the probe is out of liquid
    moisture: r.moisture
  }));

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-gray-200 text-center">
        <p className="text-gray-500 text-lg">No sensor data to display</p>
        <p className="text-gray-400 text-sm mt-2">Connect the analyzer or start demo mode to see live trends</p>
      </div>
    );
  }

  const phs = chartData.map((d) => d.pH).filter((v): v is number => v !== null);
  const lo = Math.floor(Math.min(phBand[0], ...(phs.length ? phs : [7])) - 0.5);
  const hi = Math.ceil(Math.max(phBand[1], ...(phs.length ? phs : [7])) + 0.5);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
      <h3 className="text-2xl font-bold text-gray-900 mb-1">Live Sensor Trends</h3>
      <p className="text-sm text-gray-500 mb-4">Last {chartData.length} readings (one per second from the analyzer).</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-lg font-semibold text-gray-700 mb-3">
            Soil pH <span className="text-sm font-normal text-gray-500">(shaded = preferred {phBand[0]}–{phBand[1]})</span>
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={40} />
              <YAxis domain={[lo, hi]} tick={{ fontSize: 12 }} allowDecimals={false} />
              <ReferenceArea y1={phBand[0]} y2={phBand[1]} fill="#10b981" fillOpacity={0.12} />
              <Tooltip formatter={(v: number) => (v === null ? 'probe out' : v.toFixed(2))} />
              <Line type="monotone" dataKey="pH" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} name="pH" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-700 mb-3">
            Soil moisture % <span className="text-sm font-normal text-gray-500">(shaded = good 40–70 %)</span>
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={40} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <ReferenceArea y1={40} y2={70} fill="#10b981" fillOpacity={0.12} />
              <Tooltip formatter={(v: number) => `${v} %`} />
              <Line type="monotone" dataKey="moisture" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} name="Moisture %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
