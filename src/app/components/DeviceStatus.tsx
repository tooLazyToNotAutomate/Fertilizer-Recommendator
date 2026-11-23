import { Cpu, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { SensorReading } from '../../types';
import { PROTOTYPE } from '../../utils/soilAnalysis';

interface DeviceStatusProps {
  reading: SensorReading | null;
}

type Level = 'ok' | 'warn' | 'bad' | 'na';

function Item({ label, value, level, hint }: { label: string; value: string; level: Level; hint?: string }) {
  const Icon = level === 'ok' ? CheckCircle2 : level === 'warn' ? AlertTriangle : level === 'bad' ? XCircle : Info;
  const color =
    level === 'ok' ? 'text-green-600' : level === 'warn' ? 'text-yellow-600' : level === 'bad' ? 'text-red-600' : 'text-gray-400';
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        <p className="font-semibold text-gray-900">{value}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

export function DeviceStatus({ reading }: DeviceStatusProps) {
  const r = reading;
  const hasDiag = r?.fw !== undefined;
  // the board measures its own 5 V with a ±0.1 V internal reference, so allow 5.30 (same limit as the firmware)
  const vccLevel: Level = r?.vcc === undefined ? 'na' : r.vcc >= 4.75 && r.vcc <= 5.3 ? 'ok' : r.vcc >= 4.6 && r.vcc <= 5.4 ? 'warn' : 'bad';

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="w-6 h-6 text-gray-700" />
        <h3 className="text-2xl font-bold text-gray-900">Device status</h3>
        {r && (
          <span className={`ml-auto text-xs px-2 py-1 rounded font-semibold ${r.source === 'demo' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
            {r.source === 'demo' ? 'DEMO DATA' : 'LIVE ARDUINO'}
          </span>
        )}
      </div>

      {!r ? (
        <p className="text-gray-500">No device data yet. Connect the analyzer or start demo mode.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Item
            label="pH probe"
            value={r.ph === undefined || r.probe === 0 ? 'Out of liquid' : 'In sample'}
            level={r.ph === undefined || r.probe === 0 ? 'bad' : 'ok'}
            hint={r.ph === undefined || r.probe === 0 ? 'Dip the probe in the soil slurry; LCD shows "pH: dip probe".' : undefined}
          />
          <Item
            label="pH calibration"
            value={!hasDiag ? 'Unknown (older firmware)' : r.ph_final === 1 ? '3-point buffers' : 'Estimate only'}
            level={!hasDiag ? 'warn' : r.ph_final === 1 ? 'ok' : 'warn'}
            hint={hasDiag && r.ph_final === 1 ? `pH ${PROTOTYPE.ph.buffers}, ${PROTOTYPE.ph.accuracy}` : 'Calibrate in the Sensor Lab.'}
          />
          <Item
            label="Supply (5 V)"
            value={r.vcc !== undefined ? `${r.vcc.toFixed(2)} V` : '—'}
            level={vccLevel}
            hint="USB 4.75–5.25 V (board reading ±0.1 V)"
          />
          <Item
            label="Signal noise"
            value={r.noise_mv !== undefined ? `${r.noise_mv} mV` : '—'}
            level={r.noise_mv === undefined ? 'na' : r.noise_mv <= 60 ? 'ok' : r.noise_mv <= 300 ? 'warn' : 'bad'}
            hint="Spikes are filtered; >300 mV = probe in air"
          />
          <Item label="pH board output" value={r.po !== undefined ? `${r.po.toFixed(3)} V` : '—'} level={r.po !== undefined ? 'ok' : 'na'} hint="2.51 V ≈ pH 7" />
          <Item
            label="Firmware"
            value={r.fw !== undefined ? `soil_analyzer v${(r.fw / 10).toFixed(1)}` : r.source === 'demo' ? 'simulated' : 'unknown'}
            level={r.fw !== undefined ? 'ok' : 'na'}
          />
          <Item
            label="LCD self-repairs"
            value={`${r.lcd_resets ?? 0} repairs · ${r.i2c_timeouts ?? 0} timeouts`}
            level={(r.i2c_timeouts ?? 0) > 0 ? 'warn' : 'ok'}
            hint={(r.i2c_timeouts ?? 0) > 0 ? 'A wire to the LCD is loose: push the jumpers in.' : undefined}
          />
          <Item label="Temperature / humidity" value="Assumed 25 °C / 60 %" level="na" hint="No such sensor in this build" />
        </div>
      )}

      <details className="mt-4 text-sm text-gray-700">
        <summary className="cursor-pointer font-semibold text-gray-800">About this prototype</summary>
        <ul className="mt-2 space-y-1 list-disc pl-5">
          <li>Arduino Uno (CH340) · PH-4502C pH board + glass electrode (A0) · capacitive moisture sensor HW-390 v2.0 (A1) · 16×2 I2C LCD.</li>
          <li>
            pH: 3-point calibration on {PROTOTYPE.calibratedOn} with buffers {PROTOTYPE.ph.buffers}. pH = 7 + ({PROTOTYPE.ph.v7} − Po) / {PROTOTYPE.ph.slopeVPerPh}.
            Reads every buffer within ±0.004.
          </li>
          <li>Moisture: 0 % = sensor in air (raw {PROTOTYPE.moisture.airRaw}), 100 % = sensor in water (raw {PROTOTYPE.moisture.waterRaw}).</li>
          <li>How to sample: mix 1 part soil with 2.5 parts distilled water, stir, let settle, dip the probe; rinse it with distilled water between samples.</li>
          <li>One reading per second. Calibration is stored inside the Arduino.</li>
        </ul>
      </details>
    </div>
  );
}
