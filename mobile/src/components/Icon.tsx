/** Sekme ikonları — kendi çizimlerimiz.
 *  Bir ikon fontu (vector-icons) eklemek yerine beş basit SVG yolu
 *  yeterli: paket küçük kalıyor ve üçüncü taraf görsel varlığı girmiyor. */
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type IconName = "home" | "players" | "projections" | "games" | "more";

interface Props {
  name: IconName;
  color: string;
  size?: number;
  /** Seçili sekmede dolgu, diğerlerinde yalnız çizgi. */
  filled?: boolean;
}

export default function Icon({ name, color, size = 24, filled }: Props) {
  const sw = filled ? 2.4 : 1.8;
  const common = {
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "home" && (
        <>
          <Path d="M3 10.5 12 3l9 7.5" {...common} />
          <Path d="M5.5 9.5V20h13V9.5" {...common} />
          <Path d="M9.5 20v-6h5v6" {...common} />
        </>
      )}
      {name === "players" && (
        <>
          <Circle cx={9} cy={8} r={3.2} {...common} />
          <Path d="M3.2 20c0-3.2 2.6-5.2 5.8-5.2s5.8 2 5.8 5.2" {...common} />
          <Path d="M16.5 6.6a3 3 0 0 1 0 5.8" {...common} />
          <Path d="M18 14.6c1.8.7 2.9 2.2 2.9 4.2" {...common} />
        </>
      )}
      {name === "projections" && (
        <>
          <Path d="M3.5 19.5h17" {...common} />
          <Rect x={5} y={11} width={3.6} height={6.5} rx={1} {...common} />
          <Rect x={10.2} y={7} width={3.6} height={10.5} rx={1} {...common} />
          <Rect x={15.4} y={13} width={3.6} height={4.5} rx={1} {...common} />
          <Path d="M4.5 6.5 9 3.8" {...common} strokeDasharray="2 2.5" />
        </>
      )}
      {name === "games" && (
        <>
          <Rect x={2.6} y={5.5} width={18.8} height={13} rx={3} {...common} />
          <Path d="M12 5.8v12.4" {...common} />
          <Path d="M6.4 9.6v4.8M17.6 9.6v4.8" {...common} />
        </>
      )}
      {name === "more" && (
        <>
          <Circle cx={5} cy={12} r={1.6} fill={color} stroke="none" />
          <Circle cx={12} cy={12} r={1.6} fill={color} stroke="none" />
          <Circle cx={19} cy={12} r={1.6} fill={color} stroke="none" />
        </>
      )}
    </Svg>
  );
}
