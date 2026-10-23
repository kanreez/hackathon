import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, ScrollView, ScrollViewInstance, StyleSheet, Text, TextInput, View } from "react-native";
import { Chip, ChipRow } from "../../components/Chip";
import { Header, IconButton } from "../../components/Header";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { colors, radius, spacing, typography } from "../../constants/theme";
import { askAI, askAIJson } from "../../utils/ai";

type Mode = "text" | "json";
type Message = { id: number; role: "user" | "assistant" | "error"; text: string };

const MODES = [
  { value: "text", label: "Answer" },
  { value: "json", label: "Structured data" },
] as const;

const SUGGESTIONS: Record<Mode, string[]> = {
  text: [
    "Give me 5 name ideas for a student startup",
    "Explain our app idea in one sentence for judges",
    "Plan the next 24 hours of a hackathon",
  ],
  json: [
    'List 3 project ideas as {"ideas":[{"title":string,"why":string}]}',
    'Rate this pitch from 1-10: "an app that finds study buddies" as {"score":number,"reason":string}',
  ],
};

// Edit this to give the assistant a role for your project
const SYSTEM_PROMPT =
  "You are a concise, practical assistant inside a mobile app. Answer in plain text without markdown. Keep answers short.";

function friendlyError(e: any): string {
  const msg: string = e?.message ?? "";
  if (/network request failed|failed to fetch/i.test(msg)) {
    return "Can't reach the backend. Start it with `npm run server` and keep it running.";
  }
  return msg || "Something went wrong.";
}

export default function Assistant() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [mode, setMode] = useState<Mode>("text");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const lastQ = useRef<string | undefined>(undefined);

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || thinking) return;
    setInput("");
    setMessages((m) => [...m, { id: Date.now(), role: "user", text: prompt }]);
    setThinking(true);
    try {
      const reply =
        mode === "json"
          ? JSON.stringify(await askAIJson<unknown>(prompt, { system: SYSTEM_PROMPT }), null, 2)
          : await askAI(prompt, { system: SYSTEM_PROMPT });
      setMessages((m) => [...m, { id: Date.now(), role: "assistant", text: reply }]);
    } catch (e) {
      setMessages((m) => [...m, { id: Date.now(), role: "error", text: friendlyError(e) }]);
    } finally {
      setThinking(false);
    }
  };

  // A question sent from the Home screen
  useEffect(() => {
    if (q && q !== lastQ.current) {
      lastQ.current = q;
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <ScreenWrapper>
      <Header
        title="Assistant"
        subtitle="Answers come from the AI on your server."
        right={
          messages.length ? (
            <IconButton icon="refresh" label="Start over" onPress={() => setMessages([])} />
          ) : undefined
        }
      />
      <ChipRow options={MODES} value={mode} onChange={setMode} />

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.thread}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {mode === "json" ? "Get data your screens can use" : "Ask anything"}
            </Text>
            <Text style={styles.emptyBody}>
              {mode === "json"
                ? "Describe the JSON shape in your question. In code, use askAIJson() from utils/ai.ts."
                : "Try one of these, or write your own below."}
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS[mode].map((s) => (
                <Chip key={s} label={s} onPress={() => send(s)} />
              ))}
            </View>
          </View>
        ) : (
          messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubble,
                m.role === "user" ? styles.user : m.role === "error" ? styles.error : styles.assistant,
              ]}
            >
              <Text
                selectable
                style={[
                  styles.bubbleText,
                  m.role === "user" && { color: colors.white },
                  m.role === "error" && { color: colors.error },
                  m.role === "assistant" && mode === "json" && m.text.trim().startsWith("{") && styles.code,
                ]}
              >
                {m.text}
              </Text>
            </View>
          ))
        )}
        {thinking ? (
          <View style={[styles.bubble, styles.assistant]}>
            <Text style={[styles.bubbleText, { color: colors.textMuted }]}>Thinking…</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Write a message"
          placeholderTextColor={colors.textMuted}
          multiline
          style={styles.input}
          onKeyPress={(e: any) => {
            // Enter sends on web, Shift+Enter adds a new line
            if (Platform.OS === "web" && e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <IconButton icon="arrow-up" label="Send" tone="solid" onPress={() => send(input)} />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  thread: { gap: spacing.sm, paddingVertical: spacing.md, flexGrow: 1 },
  empty: { flex: 1, justifyContent: "center", gap: spacing.sm },
  emptyTitle: { ...typography.h1, color: colors.ink },
  emptyBody: { ...typography.body, color: colors.textMuted, maxWidth: 420 },
  suggestions: { gap: spacing.sm, alignItems: "flex-start", marginTop: spacing.sm },
  bubble: { maxWidth: "88%", paddingHorizontal: spacing.md, paddingVertical: 12, borderRadius: radius.lg },
  user: { alignSelf: "flex-end", backgroundColor: colors.ink, borderBottomRightRadius: radius.sm },
  assistant: { alignSelf: "flex-start", backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm },
  error: { alignSelf: "flex-start", backgroundColor: colors.errorSoft },
  bubbleText: { ...typography.body, color: colors.ink },
  code: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), fontSize: 13, lineHeight: 19 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: 46,
    maxHeight: 140,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
});
