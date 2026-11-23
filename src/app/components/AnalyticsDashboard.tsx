import { BarChart, TrendingUp, TrendingDown, Activity, Droplet } from 'lucide-react';
import { FertilizerRecommendation, SensorReading } from '../../types';

interface AnalyticsDashboardProps {
  sensorHistory: SensorReading[];
  recommendations: FertilizerRecommendation[];
}

export function AnalyticsDashboard({ sensorHistory, recommendations }: AnalyticsDashboardProps) {
  const stats = calculateStatistics(sensorHistory);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard title="Average pH" value={stats.avgPH} decimals={2} unit="" icon={<Activity className="w-6 h-6" />} trend={stats.phTrend} color="blue" />
      <StatCard title="Average Moisture" value={stats.avgMoisture} decimals={0} unit="%" icon={<Droplet className="w-6 h-6" />} trend={stats.moistureTrend} color="green" />
      <StatCard title="Readings" value={sensorHistory.length} decimals={0} unit="" icon={<BarChart className="w-6 h-6" />} color="purple" />
      <StatCard title="Recommendations" value={recommendations.length} decimals={0} unit="" icon={<BarChart className="w-6 h-6" />} color="orange" />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number | null;
  decimals: number;
  unit: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ title, value, decimals, unit, icon, trend, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700'
  };

  return (
    <div className={`${colorClasses[color]} rounded-lg shadow-md p-6 border-2`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold uppercase tracking-wide">{title}</span>
        <div>{icon}</div>
      </div>
      <div className="flex items-baseline">
        <span className="text-4xl font-bold">{value === null ? '—' : value.toFixed(decimals)}</span>
        {unit && value !== null && <span className="ml-2 text-xl">{unit}</span>}
      </div>
      {trend && value !== null && (
        <div className="mt-2 flex items-center gap-1 text-sm">
          {trend === 'up' && (
            <>
              <TrendingUp className="w-4 h-4" />
              <span>Rising</span>
            </>
          )}
          {trend === 'down' && (
            <>
              <TrendingDown className="w-4 h-4" />
              <span>Falling</span>
            </>
          )}
          {trend === 'stable' && <span className="text-gray-600">Stable</span>}
        </div>
      )}
    </div>
  );
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

function trendOf(xs: number[], threshold: number): 'up' | 'down' | 'stable' | undefined {
  if (xs.length < 4) return undefined;
  const mid = Math.floor(xs.length / 2);
  const older = avg(xs.slice(0, mid))!;
  const recent = avg(xs.slice(mid))!;
  return recent > older + threshold ? 'up' : recent < older - threshold ? 'down' : 'stable';
}

function calculateStatistics(sensorHistory: SensorReading[]) {
  // pH is missing while the probe is out of liquid: leave those readings out of pH stats
  const phs = sensorHistory.filter((r) => r.ph !== undefined).map((r) => r.ph as number);
  const moist = sensorHistory.map((r) => r.moisture);
  return {
    avgPH: avg(phs),
    avgMoisture: avg(moist),
    phTrend: trendOf(phs, 0.2),
    moistureTrend: trendOf(moist, 5)
  };
}
