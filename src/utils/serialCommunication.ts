import { ArduinoData, ConnectionStatus } from '../types';

/**
 * Reads the Smart Soil Analyzer over Web Serial (Chrome / Edge).
 * The firmware prints one JSON line per second at 9600 baud.
 * Lines starting with '#' are human-readable messages and are ignored here.
 */
export class ArduinoSerialConnection {
  private port: any | null = null;
  private reader: any | null = null;
  private readableClosed: Promise<void> | null = null;
  private keepReading = false;
  private onDataCallback: ((data: ArduinoData) => void) | null = null;
  private onStatusCallback: ((status: ConnectionStatus) => void) | null = null;

  onData(callback: (data: ArduinoData) => void) {
    this.onDataCallback = callback;
  }

  onStatus(callback: (status: ConnectionStatus) => void) {
    this.onStatusCallback = callback;
  }

  async connect(): Promise<boolean> {
    try {
      // @ts-ignore - Web Serial isn't in the TS DOM lib yet
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 9600 });
      this.onStatusCallback?.({ connected: true });
      this.keepReading = true;
      this.readLoop();
      return true;
    } catch (error: any) {
      this.port = null;
      const msg = String(error?.message ?? error);
      let friendly = msg;
      if (/No port selected/i.test(msg)) friendly = 'No port selected.';
      else if (/Failed to open|access denied|in use/i.test(msg))
        friendly =
          'The Arduino port is busy. Close the Sensor Lab bridge (bridge.py), the Arduino IDE Serial Monitor or any other tab using it, then try again.';
      this.onStatusCallback?.({ connected: false, error: friendly });
      return false;
    }
  }

  async disconnect() {
    this.keepReading = false;
    try {
      await this.reader?.cancel();
    } catch {
      /* already closed */
    }
    try {
      await this.readableClosed?.catch(() => {});
    } catch {
      /* ignore */
    }
    try {
      await this.port?.close();
    } catch {
      /* ignore */
    }
    this.reader = null;
    this.port = null;
    this.onStatusCallback?.({ connected: false });
  }

  private async readLoop() {
    // @ts-ignore
    const decoder = new TextDecoderStream();
    this.readableClosed = this.port.readable.pipeTo(decoder.writable);
    this.reader = decoder.readable.getReader();
    let buffer = '';
    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) this.handleLine(raw.trim());
      }
    } catch (error) {
      // unplugged cable lands here
      if (this.keepReading)
        this.onStatusCallback?.({ connected: false, error: 'Lost the Arduino (cable unplugged?). Connect again.' });
    } finally {
      try {
        this.reader?.releaseLock();
      } catch {
        /* ignore */
      }
    }
  }

  private handleLine(line: string) {
    if (!line.startsWith('{')) return;
    try {
      const data = JSON.parse(line);
      // moisture is always sent; ph is missing while the probe is out of liquid
      if (typeof data.moisture === 'number') {
        this.onDataCallback?.(data as ArduinoData);
        this.onStatusCallback?.({ connected: true, lastUpdate: new Date() });
      }
    } catch {
      // partial / malformed line
    }
  }
}

export function isWebSerialSupported(): boolean {
  return 'serial' in navigator;
}
