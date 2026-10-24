import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, spacing, typography } from "../constants/theme";
import { useIsWide } from "../hooks/useIsWide";
import { confirmPayment, newIdempotencyKey } from "../services/payments";
import { Checkout, PayResult } from "../types/garage";
import { formatCents } from "../utils/booking";
import { IconTile } from "./Bits";
import { Button } from "./Button";
import { Input } from "./Input";
import { notify } from "./Toast";

type Props = {
  checkout: Checkout | null; // null = closed
  title: string; // the garage
  range: string; // "Tomorrow 09:00 – 13:00"
  breakdown: string; // "4 h × €3 = €12"
  onPaid: (result: PayResult) => void;
  onClose: () => void; // renter backed out: the caller frees the slot
  onExpired: () => void;
};

type Phase = "idle" | "processing" | "action" | "success";

const TEST_CARD = "4242 4242 4242 4242";

const digitsOf = (s: string) => s.replace(/\D/g, "");
const groupCard = (s: string) => digitsOf(s).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
const formatExpiry = (s: string) => {
  const d = digitsOf(s).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};
const pad = (n: number) => String(n).padStart(2, "0");
const formatLeft = (ms: number) => `${Math.floor(ms / 60000)}:${pad(Math.floor((ms % 60000) / 1000))}`;

// Format checks only: the server decides whether the card works, and only the number is sent
function cardErrors(card: string, expiry: string, cvc: string) {
  const errors: Record<string, string> = {};
  const n = digitsOf(card);
  if (n.length < 12) errors.card = "Enter the card number.";
  const m = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!m || +m[1] < 1 || +m[1] > 12) errors.expiry = "Use MM/YY.";
  else {
    const now = new Date();
    const yy = now.getFullYear() % 100;
    if (+m[2] < yy || (+m[2] === yy && +m[1] < now.getMonth() + 1)) errors.expiry = "This card has expired.";
  }
  if (!/^\d{3,4}$/.test(cvc)) errors.cvc = "3 or 4 digits.";
  return errors;
}

// Checkout for a booking: card or demo wallet, a held-slot countdown, and a fake
// "confirm in your bank app" step. The server decides the outcome; this only asks.
// Render it with key={checkout?.booking_id} so each booking starts with an empty form.
export function PaySheet({ checkout, title, range, breakdown, onPaid, onClose, onExpired }: Props) {
  const wide = useIsWide();
  const [phase, setPhase] = useState<Phase>("idle");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [declined, setDeclined] = useState<string | null>(null);
  const [paidWith, setPaidWith] = useState("");
  const [now, setNow] = useState(() => Date.now());
  // One key per attempt: the same card retried keeps its key, a different card gets a new one
  const attempt = useRef<{ key: string; source: string } | null>(null);

  const left = checkout ? new Date(checkout.expires_at).getTime() - now : 0;

  useEffect(() => {
    if (!checkout) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [checkout]);

  useEffect(() => {
    if (checkout && left <= 0 && phase !== "success") onExpired();
  }, [checkout, left, phase, onExpired]);

  if (!checkout) return null;
  const amount = formatCents(checkout.amount_cents);
  const busy = phase === "processing";

  const keyFor = (source: string) => {
    if (attempt.current?.source !== source) attempt.current = { key: newIdempotencyKey(), source };
    return attempt.current.key;
  };

  const handle = (result: PayResult) => {
    if (result.status === "succeeded") {
      setPaidWith(result.method === "wallet" ? "Demo wallet" : `${result.card_brand ?? "Card"} •••• ${result.card_last4 ?? ""}`);
      setPhase("success");
      setTimeout(() => onPaid(result), 900); // let the check mark land
    } else if (result.status === "requires_action") {
      setPhase("action");
    } else {
      const message = result.message ?? "The payment didn't go through.";
      setDeclined(message);
      notify(message, "error");
      setPhase("idle");
    }
  };

  const run = async (send: () => Promise<PayResult>) => {
    setDeclined(null);
    setPhase("processing");
    try {
      handle(await send());
    } catch (e: any) {
      setPhase("idle");
      if (/expired/i.test(e.message)) return onExpired();
      setDeclined(e.message);
      notify(e.message, "error");
    }
  };

  const payCard = () => {
    const next = cardErrors(card, expiry, cvc);
    setErrors(next);
    if (Object.keys(next).length) return;
    const number = digitsOf(card);
    run(() => confirmPayment(checkout.payment_id, { card_number: number, idempotency_key: keyFor(number) }));
  };

  const payWallet = () => run(() => confirmPayment(checkout.payment_id, { wallet: true, idempotency_key: keyFor("wallet") }));

  // Approve in the "bank app": same attempt, so the same key
  const approve = () =>
    run(() => confirmPayment(checkout.payment_id, { action_confirmed: true, idempotency_key: attempt.current!.key }));

  const declineAction = () => {
    setPhase("idle");
    setDeclined("You didn't approve the payment. Try again or use another card.");
  };

  return (
    <Modal visible transparent animationType={wide ? "fade" : "slide"} onRequestClose={() => {
        if (!busy) onClose();
      }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.backdrop, wide && styles.backdropWide]}>
        <View style={[styles.sheet, wide && styles.sheetWide]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.head}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.eyebrow}>Pay to confirm</Text>
                <Text style={styles.title} numberOfLines={2}>
                  {title}
                </Text>
                <Text style={styles.caption}>{range}</Text>
              </View>
              {phase !== "success" ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Cancel and close" disabled={busy} onPress={onClose} hitSlop={12} style={styles.close}>
                  <Ionicons name="close" size={22} color={colors.ink} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.amountRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.caption}>{breakdown}</Text>
                <Text style={styles.held} accessibilityLiveRegion="polite">
                  Slot held for {formatLeft(Math.max(0, left))}
                </Text>
              </View>
              <Text style={styles.amount}>{amount}</Text>
            </View>

            {phase === "success" ? (
              <View style={styles.success} accessibilityLiveRegion="polite">
                <IconTile icon="checkmark" size={56} bg={colors.successSoft} color={colors.success} />
                <Text style={styles.successTitle}>Paid {amount}</Text>
                <Text style={styles.caption}>{paidWith}</Text>
              </View>
            ) : phase === "action" ? (
              <View style={styles.bank}>
                <View style={styles.bankHead}>
                  <IconTile icon="shield-checkmark" size={44} bg={colors.surface} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bankTitle}>Confirm in your bank app</Text>
                    <Text style={styles.caption}>Your bank asks you to approve {amount} to GarageGo.</Text>
                  </View>
                </View>
                <Button title="Approve" icon="checkmark" variant="primary" onPress={approve} />
                <Button title="Cancel" variant="ghost" onPress={declineAction} />
              </View>
            ) : (
              <>
                {declined ? (
                  <View style={styles.declined} accessibilityRole="alert">
                    <Ionicons name="alert-circle" size={18} color={colors.error} />
                    <Text style={styles.declinedText}>{declined}</Text>
                  </View>
                ) : null}

                <Input
                  label="Card number"
                  placeholder="1234 5678 9012 3456"
                  keyboardType="number-pad"
                  autoComplete="cc-number"
                  value={card}
                  onChangeText={(t) => setCard(groupCard(t))}
                  error={errors.card}
                  hint={`Test card: ${TEST_CARD}`}
                  editable={!busy}
                  accessibilityLabel="Card number"
                />
                <View style={styles.pair}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Expiry"
                      placeholder="MM/YY"
                      keyboardType="number-pad"
                      autoComplete="cc-exp"
                      value={expiry}
                      onChangeText={(t) => setExpiry(formatExpiry(t))}
                      error={errors.expiry}
                      editable={!busy}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="CVC"
                      placeholder="123"
                      keyboardType="number-pad"
                      autoComplete="cc-csc"
                      secureTextEntry
                      maxLength={4}
                      value={cvc}
                      onChangeText={(t) => setCvc(digitsOf(t))}
                      error={errors.cvc}
                      editable={!busy}
                    />
                  </View>
                </View>

                <Button title={busy ? "Processing…" : `Pay ${amount}`} icon="card" variant="accent" loading={busy} onPress={payCard} />
                <Button title="Pay with demo wallet" icon="wallet" variant="secondary" disabled={busy} onPress={payWallet} />
                <Text style={styles.note}>Demo checkout: no real money moves. Card details aren&apos;t stored.</Text>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(32, 22, 15, 0.45)" },
  backdropWide: { justifyContent: "center", alignItems: "center", padding: spacing.lg },
  sheet: {
    maxHeight: "92%",
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.float,
  },
  sheetWide: { width: "100%", maxWidth: 480, borderRadius: radius.xl },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  eyebrow: { ...typography.eyebrow, color: colors.accentDeep },
  title: { ...typography.h2, color: colors.ink },
  caption: { ...typography.caption, color: colors.textMuted },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  held: { ...typography.label, color: colors.accentDeep, marginTop: 2 },
  amount: { ...typography.h1, color: colors.ink },
  pair: { flexDirection: "row", gap: spacing.sm },
  declined: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.errorSoft,
  },
  declinedText: { ...typography.label, color: colors.error, flex: 1 },
  note: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  success: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  successTitle: { ...typography.h2, color: colors.success },
  bank: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.sand },
  bankHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  bankTitle: { ...typography.h3, color: colors.ink },
});
