// Sample data for the demo (clearly marked as sample). Replace with the Supabase tables later.
const SPECIALISTS = [
  { id: "s1", trade: "plumber", name: "Plumber Georgiev (sample)", phone: "+359 88 000 0001", area: "Sofia, Lozenets" },
  { id: "s2", trade: "plumber", name: "AquaFix Sofia (sample)", phone: "+359 88 000 0002", area: "Sofia, Mladost" },
  { id: "s3", trade: "electrician", name: "Electrician Petrov (sample)", phone: "+359 88 000 0003", area: "Sofia, Lozenets" },
  { id: "s4", trade: "electrician", name: "VoltPro (sample)", phone: "+359 88 000 0004", area: "Sofia, Studentski grad" },
  { id: "s5", trade: "glazier", name: "Glass & Frames Ltd (sample)", phone: "+359 88 000 0005", area: "Sofia, Lozenets" },
  { id: "s6", trade: "glazier", name: "Stakloservice Ivanov (sample)", phone: "+359 88 000 0006", area: "Sofia, Mladost" },
  { id: "s7", trade: "locksmith", name: "Locksmith 24h (sample)", phone: "+359 88 000 0007", area: "Sofia, Lozenets" },
];

const STORES = [
  { id: "h1", name: "Hardware store Lozenets (sample)", lat: 42.6735, lng: 23.3175, product_search_url: "https://www.google.com/search?q=" },
  { id: "h2", name: "Mr. Bricolage Sofia (sample)", lat: 42.6619, lng: 23.3342, product_search_url: "https://www.google.com/search?q=" },
  { id: "h3", name: "Praktiker Sofia (sample)", lat: 42.6482, lng: 23.3721, product_search_url: "https://www.google.com/search?q=" },
  { id: "h4", name: "Plumbing supplies Mladost (sample)", lat: 42.6419, lng: 23.3787, product_search_url: "https://www.google.com/search?q=" },
];

function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestStores(lat, lng, limit = 3) {
  const hasPos = Number.isFinite(lat) && Number.isFinite(lng);
  return STORES.map((s) => ({ ...s, distance_km: hasPos ? +distanceKm(lat, lng, s.lat, s.lng).toFixed(1) : null }))
    .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
    .slice(0, limit);
}

module.exports = { SPECIALISTS, nearestStores };
