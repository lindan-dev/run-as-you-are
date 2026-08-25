import React from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useAppFonts } from "./src/theme/useAppFonts";
import { colors } from "./src/theme/colors";
import StartListScreen from "./src/screens/StartListScreen";

export default function App() {
  const fontsLoaded = useAppFonts();

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <StartListScreen />
    </SafeAreaProvider>
  );
}
