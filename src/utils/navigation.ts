import { Href, router } from "expo-router";

// router.back() with nowhere to go (a page opened by link or reloaded on web) does nothing
// and logs "GO_BACK was not handled", so fall back to a sensible parent screen
export function goBack(fallback: Href = "/") {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
