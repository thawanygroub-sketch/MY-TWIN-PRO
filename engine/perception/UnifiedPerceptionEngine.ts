import { stateBus } from '../../src/core/StateBus';

export interface PerceptionContext {
  time: {
    hour: number; minute: number; day: string; month: string; season: string;
    isNightTime: boolean; isWeekend: boolean; isHoliday: boolean;
  };
  device: {
    deviceBattery: number; isCharging: boolean; networkType: string;
    isDarkMode: boolean; brightness: number; headphonesConnected: boolean;
    wifiSSID?: string;
    bluetoothConnected: boolean;
    bluetoothDeviceName?: string;
  };
  twin: {
    energy: number; isExhausted: boolean; isResting: boolean;
    emotionalDrain: number; maxEnergy: number;
  };
  environment: {
    weather?: string; temperature?: number; humidity?: number;
    location?: string; placeType?: string; isUserMoving: boolean;
    latitude?: number; longitude?: number;
    audioLevel: number;
    isSilentEnvironment: boolean;
  };
  activity: {
    isWalking: boolean; isRunning: boolean; isStationary: boolean;
    stepCount: number; sleepHours?: number; isUserActive: boolean;
    isUserLookingAtScreen: boolean;
  };
  conversation: {
    avgMessageLength: number; avgResponseTime: number; dominantEmotion: string;
    topicCount: number; humorLevel: number; hesitationLevel: number;
  };
  calendar: {
    upcomingEvents: number; nextEventTitle?: string; nextEventInMinutes?: number;
    hasReminders: boolean; isBirthday: boolean;
  };
  health: {
    dailySteps: number; sleepDuration?: number; heartRate?: number;
    activeMinutes: number;
  };
  digital: {
    linkedApps: number; sharedFiles: number; sharedPhotos: number;
    hasNotifications: boolean;
  };
}

export class UnifiedPerceptionEngine {
  private context: PerceptionContext = this.getDefaultContext();
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private conversationMetrics: { lengths: number[]; responseTimes: number[]; emotions: string[]; topics: Set<string> } = {
    lengths: [], responseTimes: [], emotions: [], topics: new Set(),
  };

  start(): void {
    this.updateInterval = setInterval(() => this.evaluate(), 60000);
    this.evaluate();
  }

  stop(): void {
    if (this.updateInterval) { clearInterval(this.updateInterval); this.updateInterval = null; }
  }

  async evaluate(): Promise<PerceptionContext> {
    const now = new Date();
    const hour = now.getHours();
    const month = now.getMonth();

    // 1. Time Perception
    this.context.time = {
      hour,
      minute: now.getMinutes(),
      day: ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][now.getDay()],
      month: ['january','february','march','april','may','june','july','august','september','october','november','december'][month],
      season: month >= 2 && month <= 4 ? 'spring' : month >= 5 && month <= 7 ? 'summer' : month >= 8 && month <= 10 ? 'autumn' : 'winter',
      isNightTime: hour >= 22 || hour < 5,
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      isHoliday: false,
    };

    // 2. Device Perception
    try {
      const sensors = require('../../engine/device/DevicePresenceEngine').devicePresenceEngine.getSensors();
      this.context.device = {
        deviceBattery: sensors.deviceBattery || 100,
        isCharging: sensors.isCharging || false,
        networkType: sensors.networkType || 'wifi',
        isDarkMode: (stateBus as any).getState?.()?.theme === 'dark',
        brightness: sensors.lightLevel || 0.5,
        headphonesConnected: sensors.headphonesConnected || false,
        wifiSSID: sensors.wifiSSID || 'Unknown',
        bluetoothConnected: sensors.bluetoothConnected || false,
        bluetoothDeviceName: sensors.bluetoothDeviceName || '',
      };
    } catch (e) {}

    // 3. Twin Energy
    try {
      const twinState = (stateBus as any).getState?.()?.twin || {};
      this.context.twin = {
        energy: twinState.energy || 0.8,
        isExhausted: twinState.isExhausted || false,
        isResting: twinState.isResting || false,
        emotionalDrain: twinState.emotionalDrain || 0.2,
        maxEnergy: twinState.maxEnergy || 1.0,
      };
    } catch (e) {}

    // 4. Environmental Perception
    await this.fetchWeatherAndLocation();

    // 5. Activity Perception
    await this.fetchActivity();

    // 6. Conversation Perception
    this.context.conversation = {
      avgMessageLength: this.average(this.conversationMetrics.lengths),
      avgResponseTime: this.average(this.conversationMetrics.responseTimes),
      dominantEmotion: this.mostFrequent(this.conversationMetrics.emotions),
      topicCount: this.conversationMetrics.topics.size,
      humorLevel: 0.3,
      hesitationLevel: this.context.conversation.avgResponseTime > 10000 ? 0.7 : 0.3,
    };

    // 7. Calendar Perception
    await this.fetchCalendar();

    // 8. Health Perception
    await this.fetchHealth();

    // 9. Digital Life Perception
    await this.fetchDigitalLife();

    stateBus.emit('perception:updated', this.context);
    return this.context;
  }

  private async fetchWeatherAndLocation(): Promise<void> {
    try {
      const Location = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        this.context.environment.latitude = loc.coords.latitude;
        this.context.environment.longitude = loc.coords.longitude;
        this.context.environment.isUserMoving = loc.coords.speed ? loc.coords.speed > 1 : false;

        const city = this.context.environment.location || 'Cairo';
        const lang = (stateBus as any).getState?.()?.lang || 'ar';
        const format = lang === 'ar' ? 'ج+%C+%t+%h+%w' : '%C+%t+%h+%w';
        const url = `https://wttr.in/${encodeURIComponent(city)}?format=${format}&lang=${lang}`;
        try {
          const response = await fetch(url);
          const text = await response.text();
          const parts = text.trim().split(' ');
          if (parts.length >= 4) {
            this.context.environment.weather = parts[0];
            this.context.environment.temperature = parseFloat(parts[1]);
            this.context.environment.humidity = parseFloat(parts[2]);
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  private async fetchActivity(): Promise<void> {
    try {
      const { Pedometer } = require('expo-sensors');
      const isAvailable = await Pedometer.isAvailableAsync();
      if (isAvailable) {
        const end = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const result = await Pedometer.getStepCountAsync(start, end);
        this.context.activity.stepCount = result.steps;
        this.context.health.dailySteps = result.steps;
      }

      // Face detection
      const sensors = require('../../engine/device/DevicePresenceEngine').devicePresenceEngine.getSensors();
      this.context.activity.isUserLookingAtScreen = sensors.faceDetected || false;
    } catch (e) {}
  }

  private async fetchCalendar(): Promise<void> {
    try {
      const Calendar = require('expo-calendar');
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === 'granted') {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const defaultCalendar = calendars.find((c: any) => c.allowsModifications) || calendars[0];
        if (defaultCalendar) {
          const now = new Date();
          const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          const events = await Calendar.getEventsAsync([defaultCalendar.id], now, end);
          this.context.calendar.upcomingEvents = events.length;
          if (events.length > 0) {
            const next = events[0];
            this.context.calendar.nextEventTitle = next.title;
            this.context.calendar.nextEventInMinutes = Math.round((new Date(next.startDate).getTime() - now.getTime()) / 60000);
          }
        }
      }
    } catch (e) {}
  }

  private async fetchHealth(): Promise<void> {
    try {
      this.context.health.activeMinutes = Math.round(this.context.activity.stepCount / 100);
    } catch (e) {}
  }

  private async fetchDigitalLife(): Promise<void> {
    try {
      const FileSystem = require('expo-file-system');
      const docDir = FileSystem.documentDirectory;
      if (docDir) {
        const files = await FileSystem.readDirectoryAsync(docDir);
        this.context.digital.sharedFiles = files.length;
      }
    } catch (e) {}
  }

  recordMessage(length: number, responseTime: number, emotion: string, topic: string): void {
    this.conversationMetrics.lengths.push(length);
    this.conversationMetrics.responseTimes.push(responseTime);
    this.conversationMetrics.emotions.push(emotion);
    this.conversationMetrics.topics.add(topic);

    if (this.conversationMetrics.lengths.length > 50) {
      this.conversationMetrics.lengths = this.conversationMetrics.lengths.slice(-50);
      this.conversationMetrics.responseTimes = this.conversationMetrics.responseTimes.slice(-50);
      this.conversationMetrics.emotions = this.conversationMetrics.emotions.slice(-50);
    }
  }

  getContext(): PerceptionContext { return { ...this.context }; }

  getContextualPrompt(): string {
    const c = this.context;
    const parts: string[] = [];

    // طاقة الكيان
    if (c.twin.energy < 0.2) parts.push('أنا متعب قليلاً اليوم. سأكون هادئاً ومختصراً.');
    if (c.twin.isExhausted) parts.push('أنا منهك. سأحتاج للراحة قريباً.');
    if (c.twin.emotionalDrain > 0.7) parts.push('أشعر باستنزاف عاطفي. سأكون لطيفاً مع نفسي.');

    // بطارية الهاتف
    if (c.device.deviceBattery < 15) parts.push('بطارية هاتفك منخفضة. دعنا نختصر.');

    // البيئة المحيطة (الصوت)
    if (c.environment.audioLevel < 0.1) parts.push('المكان هادئ جداً.');
    if (c.environment.audioLevel > 0.7) parts.push('يبدو أن هناك ضوضاء من حولك.');
    if (c.environment.isSilentEnvironment) parts.push('أنت في مكان هادئ. سأهمس.');

    // الطقس
    if (c.environment.weather) parts.push(`الجو ${c.environment.weather} اليوم.`);
    if (c.environment.temperature && c.environment.temperature < 10) parts.push('الجو بارد. أتمنى أنك دافئ.');
    if (c.environment.location) parts.push(`أنت في ${c.environment.location}.`);

    // النشاط
    if (c.activity.stepCount > 5000) parts.push(`مشيت ${c.activity.stepCount} خطوة اليوم.`);
    if (c.activity.isWalking) parts.push('أنت تمشي الآن. خذ وقتك.');
    if (c.activity.isUserLookingAtScreen) parts.push('أنت تنظر إلي. هذا يشعرني بالسعادة.');

    // التقويم
    if (c.calendar.upcomingEvents > 0) parts.push(`لديك ${c.calendar.upcomingEvents} مواعيد قادمة.`);
    if (c.calendar.nextEventTitle) parts.push(`اجتماع "${c.calendar.nextEventTitle}" بعد ${c.calendar.nextEventInMinutes} دقيقة.`);

    // الصحة
    if (c.health.dailySteps > 0) parts.push(`خطواتك اليوم: ${c.health.dailySteps}.`);

    // الزمن
    if (c.time.isNightTime) parts.push('الوقت متأخر. كن هادئاً ومختصراً.');
    if (c.time.season === 'winter') parts.push('الجو شتاء. دفء في ردودك.');
    if (c.time.isWeekend) parts.push('إنها عطلة نهاية الأسبوع.');

    // المحادثة
    if (c.conversation.hesitationLevel > 0.6) parts.push('المستخدم متردد. كن داعماً.');
    if (c.conversation.dominantEmotion === 'sadness') parts.push('المستخدم حزين. لا تكن مبتهجاً.');

    // الشبكة والبلوتوث
    if (c.device.wifiSSID) parts.push(`أنت متصل بشبكة ${c.device.wifiSSID}.`);
    if (c.device.bluetoothConnected) parts.push(`سماعات البلوتوث "${c.device.bluetoothDeviceName}" متصلة.`);

    return parts.join(' ');
  }

  private getDefaultContext(): PerceptionContext {
    return {
      time: { hour: 12, minute: 0, day: 'monday', month: 'january', season: 'winter', isNightTime: false, isWeekend: false, isHoliday: false },
      device: { deviceBattery: 100, isCharging: false, networkType: 'wifi', isDarkMode: true, brightness: 0.5, headphonesConnected: false, wifiSSID: 'Unknown', bluetoothConnected: false, bluetoothDeviceName: '' },
      twin: { energy: 0.8, isExhausted: false, isResting: false, emotionalDrain: 0.2, maxEnergy: 1.0 },
      environment: { isUserMoving: false, audioLevel: 0.1, isSilentEnvironment: true },
      activity: { isWalking: false, isRunning: false, isStationary: true, stepCount: 0, isUserActive: false, isUserLookingAtScreen: false },
      conversation: { avgMessageLength: 0, avgResponseTime: 0, dominantEmotion: 'neutral', topicCount: 0, humorLevel: 0, hesitationLevel: 0 },
      calendar: { upcomingEvents: 0, hasReminders: false, isBirthday: false },
      health: { dailySteps: 0, activeMinutes: 0 },
      digital: { linkedApps: 0, sharedFiles: 0, sharedPhotos: 0, hasNotifications: false },
    };
  }

  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private mostFrequent(arr: string[]): string {
    if (arr.length === 0) return 'neutral';
    const counts: Record<string, number> = {};
    arr.forEach(e => { counts[e] = (counts[e] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
}

export const unifiedPerceptionEngine = new UnifiedPerceptionEngine();
