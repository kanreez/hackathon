import { useWindowDimensions } from "react-native";

// From this width the app switches to the PC layout: sidebar instead of the floating tab
// bar, centred content and two-column screens. Phones never get there.
export const WIDE_MIN_WIDTH = 1024;

export function useIsWide() {
  return useWindowDimensions().width >= WIDE_MIN_WIDTH;
}
