import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { fetchMe, Me, Role, switchRole } from "../services/manager";
import { useAuth } from "./AuthContext";

type RoleContextType = {
  role: Role;
  buildingId: string;
  canSwitch: boolean;
  loading: boolean;
  setRole: (role: Role) => Promise<void>;
};

const DEFAULT_ME: Me = { role: "resident", building_id: "demo-building", role_switch: false };

const RoleContext = createContext<RoleContextType>(null!);

export const useRole = () => useContext(RoleContext);

// Loads the role from GET /api/me after login; resident is the fallback when the backend is down
export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [me, setMe] = useState<Me>(DEFAULT_ME);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchMe()
      .then((m) => !cancelled && setMe(m))
      .catch((e) => console.warn("Could not load role:", e?.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setRole = async (role: Role) => {
    const saved = await switchRole(role);
    setMe((m) => ({ ...m, role: saved }));
  };

  return (
    <RoleContext.Provider
      value={{ role: me.role, buildingId: me.building_id, canSwitch: me.role_switch, loading: !!user && loading, setRole }}
    >
      {children}
    </RoleContext.Provider>
  );
}
