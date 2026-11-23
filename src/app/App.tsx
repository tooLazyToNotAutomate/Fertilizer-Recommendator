import { useState, useEffect, useRef } from 'react';
import { Sprout, BarChart3, TrendingUp, FileText, Download, Printer } from 'lucide-react';
import {
  SensorReading,
  ManualInputs,
  FertilizerRecommendation,
  ConnectionStatus,
  ArduinoData,
  DataSource
} from '../types';
import { ArduinoSerialConnection, isWebSerialSupported } from '../utils/serialCommunication';
import { MockDataGenerator, DemoSampleId } from '../utils/mockData';
import { RecommendationEngine } from '../utils/recommendationEngine';
import { assessSensorQuality, classifyMoisture, classifyPh, CROP_PH_RANGE } from '../utils/soilAnalysis';
import { exportRecommendationsCsv, exportSensorCsv } from '../utils/exportCsv';
import { fetchWeather, WeatherNow } from '../utils/weather';
import { SensorCard } from './components/SensorCard';
import { ConnectionPanel } from './components/ConnectionPanel';
import { DeviceStatus } from './components/DeviceStatus';
import { ManualInputForm } from './components/ManualInputForm';
import { RecommendationCard } from './components/RecommendationCard';
import { HistoryTable } from './components/HistoryTable';
import { SensorTrendChart } from './components/SensorTrendChart';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { NutrientGapChart } from './components/NutrientGapChart';
import { FertilizerDistributionChart } from './components/FertilizerDistributionChart';

type TabType = 'dashboard' | 'recommendation' | 'analytics';

const HISTORY_LIMIT = 300; // 5 minutes at one reading per second

export default function App() {
  const [sensorData, setSensorData] = useState<SensorReading | null>(null);
  const [sensorHistory, setSensorHistory] = useState<SensorReading[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ connected: false });
  const [currentRecommendation, setCurrentRecommendation] = useState<FertilizerRecommendation | undefined>();
  const [history, setHistory] = useState<FertilizerRecommendation[]>([]);
  const [isMockMode, setIsMockMode] = useState(false);
  const [demoSample, setDemoSample] = useState<DemoSampleId>('C');
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [currentManualInputs, setCurrentManualInputs] = useState<ManualInputs>({ cropType: 'rice', soilType: 'loamy' });
  const [recError, setRecError] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const weatherRef = useRef<WeatherNow | null>(null);

  // air temperature + humidity from online weather (no such sensor on the analyzer)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const w = await fetchWeather();
        if (!alive) return;
        weatherRef.current = w;
        setWeather(w);
        setWeatherError(null);
      } catch (e: any) {
        if (alive) setWeatherError(String(e?.message ?? e));
      }
    };
    load();
    const id = window.setInterval(load, 10 * 60 * 1000); // weather model updates every 15 min
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const serialConnection = useRef<ArduinoSerialConnection | null>(null);
  const mockDataGenerator = useRef<MockDataGenerator | null>(null);
  const recommendationEngine = useRef(new RecommendationEngine());

  useEffect(() => {
    serialConnection.current = new ArduinoSerialConnection();
    mockDataGenerator.current = new MockDataGenerator();

    serialConnection.current.onData((d) => handleData(d, 'arduino'));
    serialConnection.current.onStatus((st) =>
      // keep lastUpdate across messages; a fresh 'connected' clears any old error
      setConnectionStatus((prev) => (st.connected ? { ...prev, ...st, error: undefined } : st))
    );
    mockDataGenerator.current.onData((d) => handleData(d, 'demo'));

    return () => {
      serialConnection.current?.disconnect();
      mockDataGenerator.current?.stop();
    };
  }, []);

  const handleData = (data: ArduinoData, source: DataSource) => {
    const reading: SensorReading = {
      ...data,
      // the firmware's 25 °C / 60 % are placeholders: use the current weather instead
      temperature: weatherRef.current?.temperature,
      humidity: weatherRef.current?.humidity,
      timestamp: new Date(),
      quality: assessSensorQuality(data, source),
      source
    };
    setSensorData(reading);
    setSensorHistory((prev) => [...prev, reading].slice(-HISTORY_LIMIT));
  };

  const resetReadings = () => {
    setSensorData(null);
    setSensorHistory([]);
  };

  const handleConnect = async () => {
    if (!serialConnection.current) return;
    if (isMockMode) {
      mockDataGenerator.current?.stop();
      setIsMockMode(false);
    }
    resetReadings(); // don't mix demo values into real measurements
    await serialConnection.current.connect();
  };

  const handleDisconnect = async () => {
    await serialConnection.current?.disconnect();
  };

  const handleMockData = () => {
    if (!isMockMode) {
      resetReadings();
      mockDataGenerator.current?.setSample(demoSample);
      mockDataGenerator.current?.start(1000);
      setIsMockMode(true);
    } else {
      mockDataGenerator.current?.stop();
      setIsMockMode(false);
      resetReadings();
    }
  };

  const handleDemoSample = (id: DemoSampleId) => {
    setDemoSample(id);
    mockDataGenerator.current?.setSample(id);
  };

  const noDataReason = !sensorData
    ? 'No sensor data yet. Connect the analyzer (or start demo mode) first.'
    : sensorData.ph === undefined
    ? 'The pH probe is out of liquid. Dip it in the soil slurry and wait for a stable reading.'
    : undefined;

  const handleGetRecommendation = async (manualInputs: ManualInputs) => {
    if (!sensorData || noDataReason) return;
    setCurrentManualInputs(manualInputs);
    setRecError(null);
    try {
      const recommendation = await recommendationEngine.current.generateRecommendation(sensorData, manualInputs);
      setCurrentRecommendation(recommendation);
      setHistory((prev) => [recommendation, ...prev].slice(0, 20));
      setActiveTab('recommendation');
      setTimeout(() => document.getElementById('current-recommendation')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e: any) {
      setRecError(String(e?.message ?? e));
    }
  };

  const handleClearHistory = () => {
    if (confirm('Clear all recommendation history?')) {
      setHistory([]);
      setCurrentRecommendation(undefined);
    }
  };

  const handleSelectHistory = (rec: FertilizerRecommendation) => {
    setCurrentRecommendation(rec);
    document.getElementById('current-recommendation')?.scrollIntoView({ behavior: 'smooth' });
  };

  const phBand = CROP_PH_RANGE[currentManualInputs.cropType] ?? [6.0, 7.5];
  const weatherNote = weather
    ? `Online weather · ${weather.place} · ${weather.observedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : weatherError
    ? 'Weather unavailable (offline?)'
    : 'Loading local weather…';

  const tabBtn = (id: TabType, label: string, Icon: typeof BarChart3) => (
    <button
      onClick={() => setActiveTab(id)}
      aria-current={activeTab === id ? 'page' : undefined}
      className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 sm:px-6 rounded-lg text-base sm:text-lg font-semibold transition-all ${
        activeTab === id ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-blue-50 to-green-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Sprout className="w-10 h-10 sm:w-12 sm:h-12 text-green-600" />
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-900">Smart Fertilizer Advisor</h1>
          </div>
          <p className="text-lg sm:text-xl text-gray-700">
            Live soil pH &amp; moisture from the Smart Soil Analyzer, turned into fertilizer and pH-correction advice
          </p>
        </header>

        <div className="mb-8 print:hidden">
          <ConnectionPanel
            status={connectionStatus}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onMockData={handleMockData}
            isMockMode={isMockMode}
            isWebSerialSupported={isWebSerialSupported()}
            demoSample={demoSample}
            onDemoSample={handleDemoSample}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <SensorCard
            label="Soil pH"
            value={sensorData?.ph}
            unit=""
            decimals={2}
            icon="ph"
            status={sensorData?.ph !== undefined ? classifyPh(sensorData.ph) : undefined}
            emptyText={sensorData ? 'Probe out of liquid' : '--'}
            note={sensorData?.quality === 'fair' ? 'Check device status' : undefined}
          />
          <SensorCard
            label="Soil Moisture"
            value={sensorData?.moisture}
            unit="%"
            decimals={0}
            icon="moisture"
            status={sensorData ? classifyMoisture(sensorData.moisture) : undefined}
          />
          <SensorCard label="Temperature" value={weather?.temperature} unit="°C" icon="temperature" note={weatherNote} emptyText="--" />
          <SensorCard label="Humidity" value={weather?.humidity} unit="%" decimals={0} icon="humidity" note={weatherNote} emptyText="--" />
        </div>

        <div className="mb-8 print:hidden">
          <div className="bg-white rounded-lg shadow-lg p-2 border-2 border-gray-200">
            <div className="flex gap-2">
              {tabBtn('dashboard', 'Dashboard', BarChart3)}
              {tabBtn('recommendation', 'Get Recommendation', FileText)}
              {tabBtn('analytics', 'Analytics', TrendingUp)}
            </div>
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <DeviceStatus reading={sensorData} />
            <AnalyticsDashboard sensorHistory={sensorHistory} recommendations={history} />
            <SensorTrendChart data={sensorHistory} maxPoints={60} phBand={phBand} />

            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow-lg p-6 border-2 border-green-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setActiveTab('recommendation')}
                  className="bg-green-600 hover:bg-green-700 text-white py-4 px-6 rounded-lg text-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <FileText className="w-5 h-5" />
                  Get Fertilizer Recommendation
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-lg text-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-5 h-5" />
                  View Detailed Analytics
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recommendation' && (
          <div className="space-y-8">
            <ManualInputForm
              onSubmit={handleGetRecommendation}
              onChange={setCurrentManualInputs}
              initial={currentManualInputs}
              disabledReason={noDataReason}
            />
            {recError && (
              <p className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800" role="alert">
                {recError}
              </p>
            )}

            <NutrientGapChart manualInputs={currentManualInputs} cropType={currentManualInputs.cropType} />

            {currentRecommendation && (
              <div id="current-recommendation" className="scroll-mt-4">
                <RecommendationCard recommendation={currentRecommendation} />
              </div>
            )}

            {history.length > 0 && (
              <HistoryTable history={history} onClear={handleClearHistory} onSelect={handleSelectHistory} />
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <FertilizerDistributionChart recommendations={history} />
            <SensorTrendChart data={sensorHistory} maxPoints={HISTORY_LIMIT} phBand={phBand} />
            <AnalyticsDashboard sensorHistory={sensorHistory} recommendations={history} />

            <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200 print:hidden">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Data Export</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => exportSensorCsv(sensorHistory)}
                  disabled={sensorHistory.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Sensor readings (CSV)
                </button>
                <button
                  onClick={() => exportRecommendationsCsv(history)}
                  disabled={history.length === 0}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Recommendations (CSV)
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  Print / save as PDF
                </button>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                Readings are kept for the last {HISTORY_LIMIT / 60} minutes in this browser tab only; export them before closing.
              </p>
            </div>
          </div>
        )}

        <footer className="mt-12 text-center text-gray-600 text-sm">
          <p>Smart Fertilizer Advisor · Smart Soil Analyzer prototype (Arduino Uno, glass pH electrode, capacitive moisture sensor)</p>
          <p className="mt-2">
            pH calibrated with buffers 4.00 / 7.00 / 10.01. Advice is a guide: confirm large lime/sulfur doses with a soil lab and local
            agricultural experts.
          </p>
        </footer>
      </div>
    </div>
  );
}
