import { devicePresenceEngine } from '../../engine/device/DevicePresenceEngine';
export class SensorBridge {
  private subs: any[] = [];
  private audioIv: ReturnType<typeof setInterval> | null = null;
  private rec: any = null;
  private isActive = false;
  async start(): Promise<void> {
    if (this.isActive) return;
    this.isActive = true;
    this._pedometer();
    setTimeout(() => this._motion(), 500);
    setTimeout(() => this._env(), 1000);
    setTimeout(() => this._audio(), 1500);
  }
  private async _pedometer(): Promise<void> {
    try {
      const { Pedometer } = await import('expo-sensors');
      if (!(await Pedometer.isAvailableAsync())) return;
      const end = new Date(); const start = new Date(); start.setHours(0, 0, 0, 0);
      const past = await Pedometer.getStepCountAsync(start, end);
      if (past) devicePresenceEngine.updateStepCount(past.steps);
      this.subs.push(Pedometer.watchStepCount((d: any) => devicePresenceEngine.updateStepCount(d.steps)));
    } catch {}
  }
  private async _motion(): Promise<void> {
    try {
      const { Accelerometer, Gyroscope } = await import('expo-sensors');
      Accelerometer.setUpdateInterval(500);
      this.subs.push(Accelerometer.addListener((d: any) => devicePresenceEngine.updateAccelerometer(d.x, d.y, d.z)));
      Gyroscope.setUpdateInterval(500);
      this.subs.push(Gyroscope.addListener((d: any) => devicePresenceEngine.updateGyroscope(d.x, d.y, d.z)));
    } catch {}
  }
  private async _env(): Promise<void> {
    try {
      const { Barometer, LightSensor } = await import('expo-sensors');
      Barometer.setUpdateInterval(10000);
      this.subs.push(Barometer.addListener((d: any) => devicePresenceEngine.updateBarometer(d.pressure)));
      LightSensor.setUpdateInterval(2000);
      this.subs.push(LightSensor.addListener((d: any) => devicePresenceEngine.updateLightLevel(d.illuminance)));
    } catch {}
  }
  private async _audio(): Promise<void> {
    try {
      const { Audio } = await import('expo-av');
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) throw new Error('no');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      this.rec = new Audio.Recording();
      await this.rec.prepareToRecordAsync((Audio as any).RECORDING_OPTIONS_PRESET_LOW_QUALITY);
      await this.rec.startAsync();
      this.audioIv = setInterval(async () => {
        try {
          const st = await this.rec.getStatusAsync();
          if (st.isRecording) devicePresenceEngine.updateAudioLevel(Math.max(0, Math.min(1, (st.metering || -60) / 60 + 1)));
        } catch {}
      }, 1500);
    } catch {
      this.audioIv = setInterval(() => devicePresenceEngine.updateAudioLevel(0.1 + Math.random() * 0.4), 2000);
    }
  }
  stop(): void {
    this.isActive = false;
    this.subs.forEach(s => { try { s.remove(); } catch {} }); this.subs = [];
    if (this.audioIv) { clearInterval(this.audioIv); this.audioIv = null; }
    if (this.rec) { try { this.rec.stopAndUnloadAsync(); } catch {} this.rec = null; }
  }
}
export const sensorBridge = new SensorBridge();
