import Ionicons from "@expo/vector-icons/Ionicons";
import { AppIconName } from "../lib/icons";

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
};

export default function AppIcon({
  name,
  size = 24,
  color = "#222",
}: AppIconProps) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
    />
  );
}