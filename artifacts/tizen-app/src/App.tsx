import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider, useApp } from "./context/AppContext";
import ActivationPage from "./pages/ActivationPage";
import HomePage from "./pages/HomePage";
import LiveTVPage from "./pages/LiveTVPage";
import MoviesPage from "./pages/MoviesPage";
import SeriesPage from "./pages/SeriesPage";
import AddPlaylistPage from "./pages/AddPlaylistPage";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { deviceStatus } = useApp();

  // Show activation screen while not active
  if (
    deviceStatus === "loading" ||
    deviceStatus === "registering" ||
    deviceStatus === "pending" ||
    deviceStatus === "suspended" ||
    deviceStatus === "expired" ||
    deviceStatus === "error"
  ) {
    return <ActivationPage />;
  }

  // Device is active — show main app
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/live" component={LiveTVPage} />
      <Route path="/movies" component={MoviesPage} />
      <Route path="/series" component={SeriesPage} />
      <Route path="/add-playlist" component={AddPlaylistPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <WouterRouter base={base}>
          <AppRoutes />
        </WouterRouter>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
