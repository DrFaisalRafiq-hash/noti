import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Landing from "./pages/Landing.tsx";
import LogoPicker from "./pages/LogoPicker.tsx";
import IconPicker from "./pages/IconPicker.tsx";
import NotFound from "./pages/NotFound.tsx";
import VoiceMemos from "./pages/VoiceMemos.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import AdminBilling from "./pages/AdminBilling.tsx";
import AdminSupport from "./pages/AdminSupport.tsx";
import AdminBrand from "./pages/AdminBrand.tsx";
import Privacy from "./pages/Privacy.tsx";
import Terms from "./pages/Terms.tsx";
import Support from "./pages/Support.tsx";
import Fans from "./pages/Fans.tsx";
import ScriptMaker from "./pages/ScriptMaker.tsx";
import ScriptShare from "./pages/ScriptShare.tsx";
import PodcastStudio from "./pages/PodcastStudio.tsx";
import RotationTest from "./pages/RotationTest.tsx";
import FolioImport from "./pages/FolioImport.tsx";
import AuthGate from "./components/AuthGate.tsx";
import PwaIconVersionCheck from "./components/PwaIconVersionCheck.tsx";
import SafeAreaSimulator from "./components/SafeAreaSimulator.tsx";
import EdgeSwipeBack from "./components/EdgeSwipeBack.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PwaIconVersionCheck />
      <SafeAreaSimulator />
      <BrowserRouter>
        <EdgeSwipeBack />
        <Routes>
          {/* Public marketing site + auth */}
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/support" element={<Support />} />
          <Route path="/fans" element={<Fans />} />
          <Route path="/script" element={<ScriptMaker />} />
          <Route path="/script/share" element={<ScriptShare />} />
          <Route path="/rotation-test" element={<RotationTest />} />
          <Route path="/import" element={<FolioImport mode="entry" />} />
          <Route
            path="/import/confirm"
            element={
              <AuthGate>
                <FolioImport mode="confirm" />
              </AuthGate>
            }
          />
          <Route
            path="/admin/support"
            element={
              <AuthGate>
                <AdminSupport />
              </AuthGate>
            }
          />
          <Route
            path="/admin"
            element={
              <AuthGate>
                <Admin />
              </AuthGate>
            }
          />
          <Route
            path="/admin/billing"
            element={
              <AuthGate>
                <AdminBilling />
              </AuthGate>
            }
          />
          <Route
            path="/admin/brand"
            element={
              <AuthGate>
                <AdminBrand />
              </AuthGate>
            }
          />

          {/* Gated app */}
          <Route
            path="/app"
            element={
              <AuthGate>
                <Index />
              </AuthGate>
            }
          />
          <Route
            path="/logos"
            element={
              <AuthGate>
                <LogoPicker />
              </AuthGate>
            }
          />
          <Route
            path="/icons"
            element={
              <AuthGate>
                <IconPicker />
              </AuthGate>
            }
          />
          <Route
            path="/memos"
            element={
              <AuthGate>
                <VoiceMemos />
              </AuthGate>
            }
          />
          <Route
            path="/studio"
            element={
              <AuthGate>
                <PodcastStudio />
              </AuthGate>
            }
          />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
