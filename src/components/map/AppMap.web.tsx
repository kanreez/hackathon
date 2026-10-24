import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { StyleSheet, View } from "react-native";
import { colors, fonts, radius } from "../../constants/theme";
import { Coords } from "../../utils/location";
import { AppMapProps, DEFAULT_ZOOM, MapPin } from "./types";

// Browser map (Leaflet). Phones get AppMap.tsx (react-native-maps), which has no web support.
// OpenStreetMap's standard tiles: no API key, attribution required, fine for light use.
// For real traffic switch to a hosted tile provider (see the OSM tile usage policy).
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// The web font stack has double quotes ("Segoe UI"), which would end the style="" attribute
const PIN_FONT = fonts.semibold.replace(/"/g, "'");

// Price pill above the point; iconSize 0 + a CSS translate keeps it centred whatever its width
const pillIcon = (label: string, selected: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<div style="transform:translate(-50%,-115%);width:max-content;white-space:nowrap;padding:5px 10px;border-radius:999px;border:2px solid ${colors.white};box-shadow:0 4px 12px rgba(0,0,0,.45);cursor:pointer;font:600 13px/16px ${PIN_FONT};background:${selected ? colors.accent : colors.background};color:${selected ? colors.onAccent : colors.ink}">${escapeHtml(label)}</div>`,
  });

// The garage's own pin: an orange drop with a dark dot
const pickedIcon = L.divIcon({
  className: "",
  iconSize: [0, 0],
  iconAnchor: [0, 0],
  html: `<div style="transform:translate(-50%,-100%);width:30px;height:30px;border-radius:50% 50% 50% 0;rotate:-45deg;translate:0 -4px;background:${colors.accent};border:3px solid ${colors.white};box-shadow:0 4px 12px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;border-radius:50%;background:${colors.onAccent}"></div></div>`,
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function AppMap({ center, zoom = DEFAULT_ZOOM, pins = [], selectedId, onSelectPin, picked, onPick, fitToPins, interactive = true, style }: AppMapProps) {
  return (
    <View style={[styles.wrap, style]}>
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={zoom}
        // Half steps let "fit all pins" frame them tightly instead of jumping a whole level out
        zoomSnap={0.5}
        style={{ width: "100%", height: "100%" }}
        // The wheel scrolls the page, not the map; zoom with the +/- buttons or by pinching
        scrollWheelZoom={false}
        dragging={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        keyboard={interactive}
        zoomControl={interactive}
        attributionControl
      >
        <TileLayer url={TILES} attribution={ATTRIBUTION} maxZoom={19} />
        <Recenter center={center} zoom={zoom} fitTo={fitToPins && pins.length > 1 ? pins : null} />
        {onPick ? <PickOnClick onPick={onPick} /> : null}
        {pins.map((p) => (
          <PricePin key={p.id} pin={p} selected={p.id === selectedId} onSelect={onSelectPin} />
        ))}
        {picked ? <PickedPin coords={picked} onPick={onPick} /> : null}
      </MapContainer>
    </View>
  );
}

// Moves the map when `center` changes (e.g. "Use my location" or a new search), or frames
// all of `fitTo` when given
function Recenter({ center, zoom, fitTo }: { center: Coords; zoom: number; fitTo: MapPin[] | null }) {
  const map = useMap();
  const fitKey = fitTo?.map((p) => `${p.latitude},${p.longitude}`).join("|") ?? "";
  useEffect(() => {
    const frame = () => {
      // Leaflet measures its box once at start; React Native Web lays the page out after that,
      // so re-measure before framing or the zoom is worked out for the wrong size
      map.invalidateSize();
      if (fitTo) map.fitBounds(L.latLngBounds(fitTo.map((p) => [p.latitude, p.longitude])), { padding: [36, 36], maxZoom: 16 });
      else map.setView([center.latitude, center.longitude], zoom);
    };
    frame();
    // Frame again when the box changes size (layout settling, window resize, PC/phone switch)
    const observer = new ResizeObserver(frame);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
    // fitKey stands in for fitTo, which is a new array on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, center.latitude, center.longitude, zoom, fitKey]);
  return null;
}

function PickOnClick({ onPick }: { onPick: (c: Coords) => void }) {
  useMapEvents({ click: (e) => onPick({ latitude: e.latlng.lat, longitude: e.latlng.lng }) });
  return null;
}

function PricePin({ pin, selected, onSelect }: { pin: MapPin; selected: boolean; onSelect?: (id: string) => void }) {
  const icon = useMemo(() => pillIcon(pin.label, selected), [pin.label, selected]);
  return (
    <Marker
      position={[pin.latitude, pin.longitude]}
      icon={icon}
      zIndexOffset={selected ? 1000 : 0}
      keyboard
      title={pin.label}
      eventHandlers={{ click: () => onSelect?.(pin.id) }}
    />
  );
}

function PickedPin({ coords, onPick }: { coords: Coords; onPick?: (c: Coords) => void }) {
  return (
    <Marker
      position={[coords.latitude, coords.longitude]}
      icon={pickedIcon}
      draggable={!!onPick}
      zIndexOffset={2000}
      eventHandlers={{
        dragend: (e) => {
          const { lat, lng } = (e.target as L.Marker).getLatLng();
          onPick?.({ latitude: lat, longitude: lng });
        },
      }}
    />
  );
}

const styles = StyleSheet.create({
  // zIndex 0 gives Leaflet's own z-indexed panes a stacking context, so they never sit above
  // toasts or the sticky panels next to the map
  wrap: { overflow: "hidden", borderRadius: radius.lg, backgroundColor: colors.sand, zIndex: 0 },
});
