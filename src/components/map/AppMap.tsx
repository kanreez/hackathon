import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { colors, radius, typography } from "../../constants/theme";
import { AppMapProps, DEFAULT_ZOOM } from "./types";

// Phone map (react-native-maps: Apple Maps on iOS, Google Maps on Android, works in Expo Go).
// The browser gets AppMap.web.tsx instead, since react-native-maps has no web support.
export function AppMap({ center, zoom = DEFAULT_ZOOM, pins = [], selectedId, onSelectPin, picked, onPick, fitToPins, interactive = true, style }: AppMapProps) {
  const ref = useRef<MapView>(null);
  // Roughly the span a web zoom level shows, so both platforms frame the same area
  const delta = 360 / 2 ** zoom;
  const region = { latitude: center.latitude, longitude: center.longitude, latitudeDelta: delta, longitudeDelta: delta };

  const fitTo = fitToPins && pins.length > 1 ? pins : null;
  const fitKey = fitTo?.map((p) => `${p.latitude},${p.longitude}`).join("|") ?? "";

  // Moves the map when `center` changes, or frames all pins with fitToPins
  const frame = () => {
    if (fitTo) {
      ref.current?.fitToCoordinates(
        fitTo.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
        { edgePadding: { top: 60, right: 48, bottom: 48, left: 48 }, animated: true }
      );
    } else {
      ref.current?.animateToRegion({ latitude: center.latitude, longitude: center.longitude, latitudeDelta: delta, longitudeDelta: delta }, 300);
    }
  };

  useEffect(() => {
    frame();
    // fitKey stands in for the pins array, which is new on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.latitude, center.longitude, delta, fitKey]);

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onMapReady={frame}
        onPress={onPick ? (e) => onPick(e.nativeEvent.coordinate) : undefined}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        {pins.map((p) => {
          const selected = p.id === selectedId;
          return (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => onSelectPin?.(p.id)}
              zIndex={selected ? 2 : 1}
            >
              <View style={[styles.pill, selected && styles.pillOn]}>
                <Text style={[styles.pillText, selected && { color: colors.onAccent }]}>{p.label}</Text>
              </View>
            </Marker>
          );
        })}
        {picked ? (
          <Marker
            coordinate={picked}
            draggable={!!onPick}
            onDragEnd={onPick ? (e) => onPick(e.nativeEvent.coordinate) : undefined}
            pinColor={colors.accent}
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", borderRadius: radius.lg, backgroundColor: colors.sand },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.white,
  },
  pillOn: { backgroundColor: colors.accent },
  pillText: { ...typography.label, fontSize: 13, color: colors.ink },
});
