declare const __DEV__: boolean;
declare const __TEST__: boolean;
declare function require(module: string): any;

declare module 'lucide-react-native' {
  const Icon: (props: any) => any;
  export default Icon;
  export const Calendar: any;
  export const Heart: any;
  export const Sparkles: any;
  export const Clock: any;
  export const X: any;
  export const Home: any;
  export const Lightbulb: any;
  export const Thermometer: any;
  export const Music: any;
  export const Wifi: any;
  export const Power: any;
  export const Brain: any;
  export const Shield: any;
  export const FileText: any;
  export const Mail: any;
  export const Globe: any;
  export const AlertTriangle: any;
  export const Gift: any;
  export const Copy: any;
  export const Share2: any;
  export const Users: any;
  export const User: any;
  export const UserPlus: any;
  export const Star: any;
  export const BookOpen: any;
  export const Code: any;
  export const Briefcase: any;
  export const PenTool: any;
  export const Moon: any;
  export const CheckSquare: any;
  export const Image: any;
  export const Terminal: any;
  export const Bug: any;
  export const GitBranch: any;
  export const Rocket: any;
  export const ChevronRight: any;
  export const MessageCircle: any;
  export const Target: any;
  export const Link: any;
  export const Share: any;
  export const Alert: any;
  export const ActivityIndicator: any;
  export const Chrome: any;
  export const Eye: any;
  export const EyeOff: any;
  export const Send: any;
  export const Mic: any;
  export const MicOff: any;
  export const Play: any;
  export const BatteryCharging: any;
  export const Zap: any;
  export const AlertCircle: any;
  export const MessageSquare: any;
  export const RefreshCw: any;
  export const Palette: any;
  export const Wand2: any;
  export const Search: any;
  export const Camera: any;
  export const TrendingUp: any;
  export const BarChart3: any;
  export const DollarSign: any;
  export const Edit3: any;
  export const Bell: any;
  export const TreePine: any;
  export const Grid3X3: any;
  export const Settings: any;
  export const Info: any;
  export const HelpCircle: any;
  export const Crown: any;
  export const BatteryFull: any;
  export const BatteryWarning: any;
  export const Plus: any;
  export const ListChecks: any;
  export const ArrowRight: any;
  export const Volume2: any;
  export const Database: any;
  export const Languages: any;
  export const Activity: any;
  export const CheckCircle2: any;
}

declare module 'expo-clipboard' {
  export function setStringAsync(text: string): Promise<void>;
  export function getStringAsync(): Promise<string>;
}

declare module '*.mp3' { const value: number; export default value; }
declare module '*.png' { const value: number; export default value; }
declare module '*.jpg' { const value: number; export default value; }
