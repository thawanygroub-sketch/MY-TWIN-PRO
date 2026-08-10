import { devicePresenceEngine } from '../../engine/device/DevicePresenceEngine';
type SensorSub = { remove: () => void };
class SensorCollector {
  private started = false;
  private ivs: ReturnType<typeof setInterval>[] = [];
  private subs: SensorSub[] = [];
  start(): void {
    if (this.started) return;
    this.started = true;
    try {
      const S = require('expo-sensors');
      const wire = (sensor: any, interval: number, cb: (d: any) => void) => {
        try { sensor.setUpdateInterval(interval); this.subs.push(sensor.addListener(cb)); } catch {}
      };
      wire(S.Accelerometer, 400, (d: any) => devicePresenceEngine.updateAccelerometer(d.x, d.y, d.z));
      wire(S.Gyroscope, 600, (d: any) => devicePresenceEngine.updateGyroscope(d.x, d.y, d.z));
      wire(S.LightSensor, 2500, (d: any) => { if (d?.illuminance != null) devicePresenceEngine.updateLightLevel(d.illuminance); });
      wire(S.Barometer, 4000, (d: any) => { if (d?.pressure != null) devicePresenceEngine.updateBarometer(d.pressure); });
      wire(S.Pedometer, 15000, (d: any) => { if (d?.steps != null) devicePresenceEngine.updateStepCount(d.steps); });
    } catch {}
    try {
      const Battery = require('expo-battery');
      const readBat = () => Battery.getBatteryLevelAsync().then((l: number) => devicePresenceEngine.updateBattery(Math.round(l * 100))).catch(() => {});
      readBat();
      this.ivs.push(setInterval(readBat, 60000));
    } catch {}
    let lastMag = 1; let walkScore = 0;
    this.ivs.push(setInterval(() => {
      const s = devicePresenceEngine.getSensors();
      const acc = s.accelerometer;
      const mag = acc ? Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z) : 1;
      const delta = Math.abs(mag - lastMag); lastMag = mag;
      walkScore = walkScore * 0.7 + (delta > 0.12 ? 1 : 0) * 0.3;
      devicePresenceEngine.updateMovementState(walkScore > 0.35, walkScore > 0.7);
      const h = new Date().getHours();
      devicePresenceEngine.updateNightTime(h >= 22 || h < 6);
    }, 1000));
    devicePresenceEngine.start();
  }
  stop(): void {
    this.subs.forEach((s) => { try { s.remove(); } catch {} });
    this.subs = [];
    this.ivs.forEach((iv) => clearInterval(iv));
    this.ivs = [];
    this.started = false;
    devicePresenceEngine.stop();
  }
}
export const sensorCollector = new SensorCollector();
