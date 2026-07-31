import { stateBus } from '../../src/core/StateBus';
import { EventBus } from '../../src/core/EventBus';
import { audioEngine } from '../../src/core/AudioEngine';

export interface DeviceSensors {
  accelerometer: { x: number; y: number; z: number } | null;
  gyroscope: { x: number; y: number; z: number } | null;
  barometer: number | null;
  proximity: number | null;
  lightLevel: number | null;
  audioLevel: number;
  weatherCondition: 'clear' | 'rain' | 'storm' | 'unknown';
  stepCount: number;
  deviceBattery: number | null;
  isBatteryLow: boolean;
  isCameraReady: boolean;
  isMicrophoneReady: boolean;
  hasUserPermission: boolean;
  faceDetected: boolean;
  faceBounds: { x: number; y: number; width: number; height: number } | null;
  userWalking: boolean;
  userRunning: boolean;
  userStationary: boolean;
  isNightTime: boolean;
  isQuietTime: boolean;
}

export class DevicePresenceEngine {
  private sensors: DeviceSensors = {
    accelerometer: null, gyroscope: null, barometer: null, proximity: null,
    lightLevel: null, audioLevel: 0, weatherCondition: 'unknown', stepCount: 0,
    deviceBattery: 100, isBatteryLow: false, isCameraReady: false, isMicrophoneReady: false,
    hasUserPermission: false, faceDetected: false, faceBounds: null,
    userWalking: false, userRunning: false, userStationary: true,
    isNightTime: false, isQuietTime: false,
  };

  private _isActive: boolean = false;

  // ✅ خاصية isActive المطلوبة
  get isActive(): boolean {
    return this._isActive;
  }

  start(): void {
    this._isActive = true;
  }

  stop(): void {
    this._isActive = false;
  }

  setUserPermission(granted: boolean): void {
    this.sensors.hasUserPermission = granted;
  }

  updateBattery(level: number): void {
    this.sensors.deviceBattery = level;
    this.sensors.isBatteryLow = level < 20;
    if (this.sensors.isBatteryLow) {
      EventBus.emit('DEVICE_BATTERY_LOW', { level });
    }
  }

  updateAccelerometer(x: number, y: number, z: number): void { this.sensors.accelerometer = { x, y, z }; }
  updateGyroscope(x: number, y: number, z: number): void { this.sensors.gyroscope = { x, y, z }; }
  updateBarometer(pressure: number): void {
    this.sensors.barometer = pressure;
    if (pressure < 990) this.sensors.weatherCondition = 'storm';
    else if (pressure < 1010) this.sensors.weatherCondition = 'rain';
    else this.sensors.weatherCondition = 'clear';
  }
  updateLightLevel(illuminance: number): void {
    this.sensors.lightLevel = illuminance;
    this.sensors.isNightTime = illuminance < 10;
    this.sensors.isQuietTime = this.sensors.isNightTime;
  }
  updateAudioLevel(level: number): void { this.sensors.audioLevel = level; }
  updateStepCount(steps: number): void { this.sensors.stepCount = steps; }
  updateFaceDetected(bounds: any): void {}
  getSensors(): DeviceSensors { return { ...this.sensors }; }
}

export const devicePresenceEngine = new DevicePresenceEngine();
