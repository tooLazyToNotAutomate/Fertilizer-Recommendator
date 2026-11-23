import { Plug, PlugZap, WifiOff, FlaskConical, ExternalLink } from 'lucide-react';
import { ConnectionStatus } from '../../types';
import { DEMO_SAMPLES, DemoSampleId } from '../../utils/mockData';

interface ConnectionPanelProps {
  status: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  onMockData: () => void;
  isMockMode: boolean;
  isWebSerialSupported: boolean;
  demoSample: DemoSampleId;
  onDemoSample: (id: DemoSampleId) => void;
}

export function ConnectionPanel({
  status,
  onConnect,
  onDisconnect,
  onMockData,
  isMockMode,
  isWebSerialSupported,
  demoSample,
  onDemoSample
}: ConnectionPanelProps) {
  const subtitle = status.connected
    ? status.lastUpdate
      ? `Connected · last reading ${status.lastUpdate.toLocaleTimeString()}`
      : 'Connected · waiting for the first reading…'
    : isMockMode
    ? 'Demo mode: simulated readings from the three exhibition jars'
    : 'Not connected';

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-3">
          {status.connected ? (
            <PlugZap className="w-6 h-6 text-green-600" />
          ) : isMockMode ? (
            <FlaskConical className="w-6 h-6 text-blue-600" />
          ) : (
            <WifiOff className="w-6 h-6 text-gray-400" />
          )}
          <div>
            <h3 className="text-xl font-bold text-gray-900">Smart Soil Analyzer</h3>
            <p className="text-sm text-gray-600">{subtitle}</p>
          </div>
        </div>
        <div
          className={`w-3 h-3 rounded-full shrink-0 ${
            status.connected ? 'bg-green-500 animate-pulse' : isMockMode ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'
          }`}
          aria-hidden
        />
      </div>

      {status.error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg" role="alert">
          <p className="text-red-800 text-sm">{status.error}</p>
        </div>
      )}

      {!isWebSerialSupported && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
          <p className="text-yellow-800 text-sm">
            This browser can't talk to the Arduino (no Web Serial). Use Chrome or Edge on a laptop. Demo mode still works.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {!status.connected ? (
          <>
            {isWebSerialSupported && (
              <button
                onClick={onConnect}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg text-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Plug className="w-5 h-5" />
                Connect Arduino
              </button>
            )}
            <button
              onClick={onMockData}
              aria-pressed={isMockMode}
              className={`flex-1 ${
                isMockMode ? 'bg-blue-800 ring-2 ring-blue-300' : 'bg-blue-600 hover:bg-blue-700'
              } text-white py-3 px-6 rounded-lg text-lg font-semibold transition-colors`}
            >
              {isMockMode ? 'Stop demo' : 'Demo mode'}
            </button>
          </>
        ) : (
          <button
            onClick={onDisconnect}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg text-lg font-semibold transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>

      {isMockMode && !status.connected && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">Simulated sample (probe dipped in):</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(Object.keys(DEMO_SAMPLES) as DemoSampleId[]).map((id) => (
              <button
                key={id}
                onClick={() => onDemoSample(id)}
                aria-pressed={demoSample === id}
                className={`py-2 px-3 rounded-lg border-2 text-sm font-semibold transition-colors ${
                  demoSample === id
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                }`}
              >
                {DEMO_SAMPLES[id].name}
                <span className="block text-xs font-normal text-gray-500">pH ≈ {DEMO_SAMPLES[id].ph}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500">
        Connect needs the analyzer running its final firmware over USB. Only one program can use the port: close the
        Sensor Lab bridge or the Arduino IDE first.{' '}
        <a href="/sensor-lab/" className="text-blue-700 underline inline-flex items-center gap-1">
          Sensor Lab (wiring &amp; calibration) <ExternalLink className="w-3 h-3" />
        </a>
      </p>
    </div>
  );
}
