import {
  useFonts,
  BigShoulders_700Bold,
  BigShoulders_800ExtraBold,
} from "@expo-google-fonts/big-shoulders";
import { SourceSerif4_400Regular, SourceSerif4_600SemiBold } from "@expo-google-fonts/source-serif-4";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { fonts } from "./colors";

/** Loads the three brand fonts used across every mockup screen. Returns
 * true once they're ready to use via the `fonts` map in colors.ts. */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    [fonts.displayBold]: BigShoulders_700Bold,
    [fonts.display]: BigShoulders_800ExtraBold,
    [fonts.body]: SourceSerif4_400Regular,
    [fonts.bodySemibold]: SourceSerif4_600SemiBold,
    [fonts.mono]: JetBrainsMono_400Regular,
    [fonts.monoMedium]: JetBrainsMono_500Medium,
  });
  return loaded;
}
