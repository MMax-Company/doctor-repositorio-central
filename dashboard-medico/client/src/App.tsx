import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Router as WouterRouter } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Atendimento from "./pages/Atendimento";
import Historico from "./pages/Historico";
import Documentos from "./pages/Documentos";

function AppRouter() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/atendimento/:id"} component={Atendimento} />
      <Route path={"/historico"} component={Historico} />
      <Route path={"/documentos"} component={Documentos} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <WouterRouter base="/painel-medico">
      <ErrorBoundary>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <AppRouter />
          </TooltipProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </WouterRouter>
  );
}

export default App;
