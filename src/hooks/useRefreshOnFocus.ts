import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

/**
 * Calls `refresh` every time the screen comes back into focus (e.g. after
 * saving on another screen), but not on the first mount, where the data
 * is already loading.
 */
export function useRefreshOnFocus(refresh: () => void) {
  const first = useRef(true);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      refreshRef.current();
    }, [])
  );
}
