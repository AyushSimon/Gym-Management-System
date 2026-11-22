import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface Ctx {
  /** Increases whenever any page changes data, so shared widgets (notifications, member drawer) can refetch. */
  version: number;
  bump: () => void;
}

const DataVersionContext = createContext<Ctx>({ version: 0, bump: () => undefined });

export function DataVersionProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(() => ({ version, bump }), [version, bump]);
  return <DataVersionContext.Provider value={value}>{children}</DataVersionContext.Provider>;
}

export const useDataVersion = () => useContext(DataVersionContext);
