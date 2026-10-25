import { t } from "../i18n";

export function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t("ago.now");
  if (mins < 60) return t("ago.min", { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t("ago.h", { n: hours });
  return t("ago.d", { n: Math.round(hours / 24) });
}

