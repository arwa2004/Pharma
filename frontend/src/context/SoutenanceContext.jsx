import { createContext, useContext, useState, useEffect } from "react";

const SoutenanceContext = createContext({
  modeSoutenance: false,
  setModeSoutenance: () => {},
});

export function SoutenanceProvider({ children }) {
  const [modeSoutenance, setModeSoutenance] = useState(() => {
    return localStorage.getItem("mode_soutenance") === "true";
  });

  useEffect(() => {
    localStorage.setItem("mode_soutenance", modeSoutenance);
  }, [modeSoutenance]);

  return (
    <SoutenanceContext.Provider value={{ modeSoutenance, setModeSoutenance }}>
      {children}
    </SoutenanceContext.Provider>
  );
}

export const useSoutenance = () => useContext(SoutenanceContext);
