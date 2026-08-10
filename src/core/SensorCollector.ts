import { devicePresenceEngine } from '../../engine/device/DevicePresenceEngine';
class SensorCollector {
  private started = false;
  private ivs: any[] = [];
  start(): void {
    if (this.started) return;
    this.started = true;
    try {
      const { Accelerometer, Gyroscope, LightSensor, Barometer } = require('expo-sensors');
      try { Accelerometer.setUpdateInterval(400); Accelerometer.addListener((d: any) => devicePresenceEngine.updateAccelerometer(d.x, d.y, d.z)); } catch {}
      try { Gyroscope.setUpdateInterval(600); Gyroscope.addListener((d: any) => devicePresenceEngine.updateGyroscope(d.x, d.y, d.z)); } catch {}
      try { LightSensor.setUpdateInterval(2500); LightSensor.addListener((d: any) => d?.illuminance != null && devicePresenceEngine.updateLightLevel(d.illuminance)); } catch {}
      try { Barometer.setUpdateInterval(4000); Barometer.addListener((d: any) => d?.pressure != null && devicePresenceEngine.updateBarometer(d.pressure)); } catch {}
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
  stop(): void { this.ivs.forEach((iv) => clearInterval(iv)); this.ivs = []; this.started = false; devicePresenceEngine.stop(); }
}
export const sensorCollector = new SensorCollector();
