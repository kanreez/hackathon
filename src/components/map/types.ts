import { StyleProp, ViewStyle } from "react-native";
import { Coords } from "../../utils/location";

// A garage on the map, drawn as a small price pill
export type MapPin = Coords & { id: string; label: string };

// Shared by AppMap.tsx (phone, react-native-maps) and AppMap.web.tsx (PC / browser, Leaflet)
export type AppMapProps = {
  center: Coords; // where the map looks; changing it moves the map there
  zoom?: number; // 13 ≈ a whole city, 15 ≈ a few streets, 17 ≈ one street
  recenterKey?: number; // changing it moves the map to center/zoom again, even if they're the same
  pins?: MapPin[];
  selectedId?: string | null;
  onSelectPin?: (id: string) => void;
  picked?: Coords | null; // a single pin, e.g. the garage's location
  onPick?: (coords: Coords) => void; // with it, tapping the map or dragging the pin moves `picked`
  fitToPins?: boolean; // frame all pins (when there are 2+) instead of using center/zoom
  interactive?: boolean; // false = a still preview that can't be panned or zoomed
  style?: StyleProp<ViewStyle>; // give it a height
};

export const DEFAULT_ZOOM = 14;
