import React from 'react';
import { Canvas, Circle, Path, Group } from '@shopify/react-native-skia';

type EyeExpression = 
  | 'normal' | 'closed' | 'happy' | 'sad' | 'angry'
  | 'surprised' | 'x_eyes' | 'heart' | 'stars' | 'spiral' | 'reject';

interface LivingEyesProps {
  size: number;
  expression: string;
  eyeOpenness: number;
  pupilSize: number;
  gazeX: number;
  gazeY: number;
}

export const LivingEyes: React.FC<LivingEyesProps> = ({
  size, expression, eyeOpenness, pupilSize, gazeX, gazeY,
}) => {
  const eo = eyeOpenness;
  const ps = pupilSize;
  const gx = gazeX;
  const gy = gazeY;

  const renderEye = (cx: number, cy: number) => {
    if (eo < 0.05) {
      return (
        <Path
          key={`eye-${cx}`}
          path={`M ${cx - 15} ${cy} L ${cx + 15} ${cy}`}
          color="#ffffff"
          style="stroke"
          strokeWidth={3}
        />
      );
    }

    const eyeRadius = size * 0.08 * Math.max(0.3, eo);

    switch (expression) {
      case 'heart':
        return (
          <Path
            key={`eye-${cx}`}
            path={`M ${cx} ${cy + 5} C ${cx - 14} ${cy - 10}, ${cx - 14} ${cy - 20}, ${cx} ${cy - 10} C ${cx + 14} ${cy - 20}, ${cx + 14} ${cy - 10}, ${cx} ${cy + 5}`}
            color="#EC4899"
          />
        );
      case 'x_eyes':
      case 'reject':
        return (
          <Group key={`eye-${cx}`}>
            <Path path={`M ${cx - 12} ${cy - 12} L ${cx + 12} ${cy + 12}`} color="#EF4444" style="stroke" strokeWidth={4} />
            <Path path={`M ${cx + 12} ${cy - 12} L ${cx - 12} ${cy + 12}`} color="#EF4444" style="stroke" strokeWidth={4} />
          </Group>
        );
      case 'happy':
        return (
          <Path
            key={`eye-${cx}`}
            path={`M ${cx - 15} ${cy} Q ${cx} ${cy - 12} ${cx + 15} ${cy}`}
            color="#ffffff"
            style="stroke"
            strokeWidth={4}
          />
        );
      case 'sad':
        return (
          <Group key={`eye-${cx}`}>
            <Circle cx={cx} cy={cy + 3} r={eyeRadius} color="#ffffff" />
            <Circle cx={cx + gx * 0.3} cy={cy + 8} r={size * 0.035 * ps} color="#3B82F6" />
            <Circle cx={cx + gx * 0.3} cy={cy + 16} r={size * 0.02 * ps} color="#60A5FA" opacity={0.5} />
          </Group>
        );
      case 'angry':
        return (
          <Group key={`eye-${cx}`}>
            <Circle cx={cx} cy={cy} r={eyeRadius} color="#ffffff" />
            <Circle cx={cx + gx * 0.3} cy={cy} r={size * 0.035 * ps} color="#EF4444" />
            <Path path={`M ${cx - 15} ${cy - 15} L ${cx + 15} ${cy - 10}`} color="#ffffff" style="stroke" strokeWidth={3} />
          </Group>
        );
      case 'surprised':
        return (
          <Group key={`eye-${cx}`}>
            <Circle cx={cx} cy={cy} r={eyeRadius * 1.3} color="#ffffff" />
            <Circle cx={cx + gx * 0.3} cy={cy} r={size * 0.05 * ps} color="#000000" />
          </Group>
        );
      case 'stars':
        return (
          <Path
            key={`eye-${cx}`}
            path={`M ${cx} ${cy - 15} L ${cx + 3} ${cy - 5} L ${cx + 13} ${cy - 5} L ${cx + 5} ${cy + 2} L ${cx + 8} ${cy + 12} L ${cx} ${cy + 6} L ${cx - 8} ${cy + 12} L ${cx - 5} ${cy + 2} L ${cx - 13} ${cy - 5} L ${cx - 3} ${cy - 5} Z`}
            color="#FCD34D"
          />
        );
      default:
        return (
          <Group key={`eye-${cx}`}>
            <Circle cx={cx} cy={cy} r={eyeRadius} color="#ffffff" />
            <Circle cx={cx + gx * 0.4} cy={cy + gy * 0.4} r={size * 0.035 * ps} color="#000000" />
          </Group>
        );
    }
  };

  return (
    <Canvas style={{ width: size, height: size * 0.5 }}>
      {renderEye(size * 0.3, size * 0.25)}
      {renderEye(size * 0.7, size * 0.25)}
    </Canvas>
  );
};
