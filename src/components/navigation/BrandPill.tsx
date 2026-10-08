import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme";

export default function BrandPill() {
  return <View accessibilityLabel="Pagariya Auto" style={styles.pill}><View style={styles.dot} /><Text style={styles.text}>PAGARIYA AUTO</Text></View>;
}

const styles = StyleSheet.create({
  pill: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  text: { color: colors.text, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
});
