import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Router as WouterRouter } from "wouter";

import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

function AppRouter() {

  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

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