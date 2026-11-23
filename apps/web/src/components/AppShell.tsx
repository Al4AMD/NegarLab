import type { Theme } from "../lib/theme";
import { Header } from "./Header";
import { ModuleRail } from "./ModuleRail";
import { ParameterDock } from "./ParameterDock";
import { Stage } from "./Stage";
import { TransportBar } from "./TransportBar";

interface AppShellProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export function AppShell({ theme, onToggleTheme }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header theme={theme} onToggleTheme={onToggleTheme} />
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[14rem_minmax(0,1fr)_18rem]">
        <ModuleRail />
        <Stage />
        <ParameterDock />
      </div>
      <TransportBar />
    </div>
  );
}
