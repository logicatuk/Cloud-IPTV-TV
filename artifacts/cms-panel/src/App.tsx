import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { clearAuth } from "@/lib/auth";
import "@/lib/api-init";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Devices from "@/pages/devices";
import Resellers from "@/pages/resellers";
import ResellerDetail from "@/pages/reseller-detail";
import Servers from "@/pages/servers";
import Credits from "@/pages/credits";
import AuditLogs from "@/pages/audit-logs";
import Profile from "@/pages/profile";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any) => {
      if (error?.status === 401) {
        clearAuth();
        window.location.href = "/login";
      }
    },
  }),
});

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/devices" component={Devices} />
      <Route path="/resellers" component={Resellers} />
      <Route path="/resellers/:id" component={ResellerDetail} />
      <Route path="/servers" component={Servers} />
      <Route path="/credits" component={Credits} />
      <Route path="/audit-logs" component={AuditLogs} />
      <Route path="/profile" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
