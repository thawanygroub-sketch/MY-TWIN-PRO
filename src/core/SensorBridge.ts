import { devicePresenceEngine } from '../../engine/device/DevicePresenceEngine';

export class SensorBridge {
  private accelerometerSub: any = null;
  private gyroscopeSub: any = null;
  private barometerSub: any = null;
  private lightSensorSub: any = null;
  private pedometerSub: any = null;
  private audioSimInterval: ReturnType<typeof setInterval> | null = null;
  private isActive = false;

  async start(): Promise<void> {
    if (this.isActive) return;
    this.isActive = true;

    try {
      const { Accelerometer, Gyroscope, Barometer, LightSensor, Pedometer } = await import('expo-sensors');

      this.accelerometerSub = Accelerometer.addListener((data: any) => {
        devicePresenceEngine.updateAccelerometer(data.x, data.y, data.z);
      });
      Accelerometer.setUpdateInterval(100);

      this.gyroscopeSub = Gyroscope.addListener((data: any) => {
        devicePresenceEngine.updateGyroscope(data.x, data.y, data.z);
      });
      Gyroscope.setUpdateInterval(100);

      this.barometerSub = Barometer.addListener((data: any) => {
        devicePresenceEngine.updateBarometer(data.pressure);
      });
      Barometer.setUpdateInterval(5000);

      this.lightSensorSub = LightSensor.addListener((data: any) => {
        devicePresenceEngine.updateLightLevel(data.illuminance);
      });
      LightSensor.setUpdateInterval(1000);

      try {
        const pedometerResult = await Pedometer.isAvailableAsync();
        if (pedometerResult) {
          const end = new Date();
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          const pastStepCount = await Pedometer.getStepCountAsync(start, end);
          if (pastStepCount) {
            devicePresenceEngine.updateStepCount(pastStepCount.steps);
          }
          this.pedometerSub = Pedometer.watchStepCount((data: any) => {
            devicePresenceEngine.updateStepCount(data.steps);
          });
        }
      } catch (e) {
        console.log('[SensorBridge] Pedometer not available');
      }

      // بدء التقاط الصوت (حقيقي أو محاكاة)
      await this.startAudioCapture();

      console.log('[SensorBridge] ✅ All sensors connected');
    } catch (e) {
      console.warn('[SensorBridge] ⚠️ Sensors unavailable:', e);
    }
  }

  private async startAudioCapture(): Promise<void> {
    try {
      const { Audio } = await import('expo-av');
      const permission = await Audio.requestPermissionsAsync();
      if (permission.granted) {
        // نبدأ التسجيل لمراقبة مستوى الصوت فقط
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync((Audio as any).RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
        await recording.startAsync();
        this.audioSimInterval = setInterval(async () => {
          try {
            const status = await recording.getStatusAsync();
            if (status.isRecording) {
              // تحويل metering إلى قيمة بين 0 و 1
              const level = Math.max(0, Math.min(1, (status.metering || -60) / 60 + 1));
              devicePresenceEngine.updateAudioLevel(level);
            }
          } catch (e) {}
        }, 500);
        console.log('[SensorBridge] 🎤 Real audio capture started');
        return;
      }
    } catch (e) {
      console.log('[SensorBridge] Audio capture not available, falling back to simulation');
    }
    // احتياطي: محاكاة مستوى الصوت
    this.startAudioLevelSimulation();
  }

  private startAudioLevelSimulation(): void {
    this.audioSimInterval = setInterval(() => {
      const level = 0.1 + Math.random() * 0.4;
      devicePresenceEngine.updateAudioLevel(level);
    }, 1000);
  }

  stop(): void {
    this.isActive = false;
    if (this.accelerometerSub) { this.accelerometerSub.remove(); this.accelerometerSub = null; }
    if (this.gyroscopeSub) { this.gyroscopeSub.remove(); this.gyroscopeSub = null; }
    if (this.barometerSub) { this.barometerSub.remove(); this.barometerSub = null; }
    if (this.lightSensorSub) { this.lightSensorSub.remove(); this.lightSensorSub = null; }
    if (this.pedometerSub) { this.pedometerSub.remove(); this.pedometerSub = null; }
    if (this.audioSimInterval) { clearInterval(this.audioSimInterval); this.audioSimInterval = null; }
    console.log('[SensorBridge] All sensors disconnected');
  }
}

export const sensorBridge = new SensorBridge();
