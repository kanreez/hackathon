// GarageGo door bridge for an ESP32 (Wokwi simulation or a real DevKitC).
// Wokwi: paste this file into sketch.ino and diagram.json (same folder) into the diagram.json tab, then press play.
// Speaks the same contract as server/fake-device.js:
//   every POLL_MS:  GET  /api/device/commands  (header X-Device-Key) -> {} or { command_id, action: "open" | "close" }
//   on a command:   click the relay (= press the opener's wall button), set the LED, then
//                   POST /api/device/ack  { command_id, status: "opened" | "error" }  ("opened" = carried out)
// The phone never talks to this board. The server only queues a command for a renter
// with a paid booking that covers right now, so this sketch has no auth logic of its own.
//
// Demo: the LED (GPIO 2) is the door. On after "open", off after "close".
// Real door later: relay module IN -> GPIO 4, relay COM/NO -> the opener's wall-button terminals.
// Board: "ESP32 Dev Module". No extra libraries needed.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// ---------- change these ----------
// Wokwi simulation: "Wokwi-GUEST" with no password. Real board: your 2.4 GHz Wi-Fi.
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";
// Wokwi simulation: the https://....trycloudflare.com address that
// `cloudflared tunnel --url http://localhost:3000` prints (no slash at the end). It changes on every restart.
// Real board on the same Wi-Fi as the server PC: http://<server PC IP>:3000
const char* SERVER_URL = "https://CHANGE-ME.trycloudflare.com";
// From the host screen ("Pair a device"). Seed garages: dev-door-lagera-1, dev-door-krasno-2
const char* DEVICE_KEY = "dev-door-lagera-1";
// ----------------------------------

const int RELAY_PIN = 4;
const int LED_PIN = 2;
// Most cheap blue relay modules switch on LOW. If yours clicks at boot and not on Open, flip this.
const bool RELAY_ACTIVE_HIGH = true;

const unsigned long POLL_MS = 300;         // the server drops a command after 20 s, so this is plenty
const unsigned long RELAY_PULSE_MS = 500;  // how long the "button" is held
const int ACK_TRIES = 3;

// One connection kept open between requests: a new TLS handshake per poll takes seconds
WiFiClient plainClient;
WiFiClientSecure tlsClient;
HTTPClient http;
const bool useTls = strncmp(SERVER_URL, "https", 5) == 0;
unsigned long lastPoll = 0;

void setRelay(bool on) {
  digitalWrite(RELAY_PIN, on == RELAY_ACTIVE_HIGH ? HIGH : LOW);
}

// One button press on the opener, then the LED shows the door's new state
void triggerDoor(bool open) {
  Serial.println(open ? "[DOOR] OPEN  -> LED on" : "[DOOR] CLOSE -> LED off");
  setRelay(true);
  delay(RELAY_PULSE_MS);
  setRelay(false);
  digitalWrite(LED_PIN, open ? HIGH : LOW);
}

void beginRequest(const char* path) {
  String url = String(SERVER_URL) + path;
  if (useTls) http.begin(tlsClient, url);
  else http.begin(plainClient, url);
  http.addHeader("X-Device-Key", DEVICE_KEY);
}

// Pulls "value" out of {"key":"value"} without a JSON library. Empty if missing.
String jsonString(const String& body, const char* key) {
  String needle = String("\"") + key + "\":\"";
  int start = body.indexOf(needle);
  if (start < 0) return "";
  start += needle.length();
  int end = body.indexOf('"', start);
  return end < 0 ? "" : body.substring(start, end);
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("[WiFi] connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(250);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] online, IP %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] failed, retrying");
  }
}

// Tells the server what happened, so the app shows "Opened" / "Closed" (or the error)
void ack(const String& commandId, bool ok, const char* error) {
  String body = String("{\"command_id\":\"") + commandId + "\",\"status\":\"" + (ok ? "opened" : "error") + "\"";
  if (!ok) body += String(",\"error\":\"") + error + "\"";
  body += "}";

  for (int i = 0; i < ACK_TRIES; i++) {
    beginRequest("/api/device/ack");
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(body);
    if (code > 0) http.getString();  // read the reply so the connection can be reused
    http.end();
    if (code == 200) {
      Serial.printf("[ACK] %s -> 200\n", ok ? "done" : "error");
      return;
    }
    Serial.printf("[ACK] failed (%d), retrying\n", code);
    delay(300);
  }
}

void poll() {
  beginRequest("/api/device/commands");
  int code = http.GET();
  String body = code > 0 ? http.getString() : "";
  http.end();

  if (code == 401) {
    Serial.println("[HTTP] 401: unknown device key. Check DEVICE_KEY against the host screen.");
    delay(5000);
    return;
  }
  if (code != 200) {
    Serial.printf("[HTTP] poll failed (%d). Is the server (and the tunnel) running at %s?\n", code, SERVER_URL);
    delay(1000);
    return;
  }

  String commandId = jsonString(body, "command_id");
  if (commandId.isEmpty()) return;  // {} = nothing to do

  String action = jsonString(body, "action");
  Serial.printf("[CMD] %s (%s)\n", action.c_str(), commandId.c_str());
  if (action == "open" || action == "close") {
    triggerDoor(action == "open");
    ack(commandId, true, nullptr);
  } else {
    ack(commandId, false, "Unknown action");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  setRelay(false);
  digitalWrite(LED_PIN, LOW);

  tlsClient.setInsecure();  // no certificate check: fine for the demo, not for a real door
  http.setReuse(true);
  http.setTimeout(5000);

  Serial.println("\nGarageGo door bridge");
  Serial.printf("Server %s, key %s\n", SERVER_URL, DEVICE_KEY);
  Serial.println("Type \"open\" or \"close\" in the Serial Monitor to test the LED without the server.");
  connectWifi();
}

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line == "open" || line == "close") triggerDoor(line == "open");
  }

  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    return;
  }

  if (millis() - lastPoll >= POLL_MS) {
    lastPoll = millis();
    poll();
  }
}
