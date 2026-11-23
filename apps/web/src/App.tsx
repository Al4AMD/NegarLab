import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { applyTheme, getInitialTheme, type Theme } from "./lib/theme";

export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <AppShell theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
  );
}
