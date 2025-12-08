import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import Sources from "./pages/Sources";
import SourceDetail from "./pages/SourceDetail";
import Requirements from "./pages/Requirements";
import AskQuestion from "./pages/AskQuestion";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>
          <OnboardingProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Navigate to="/sources" replace />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route
                    path="/sources"
                    element={
                      <ProtectedRoute>
                        <Sources />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/sources/:id"
                    element={
                      <ProtectedRoute>
                        <SourceDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/requirements"
                    element={
                      <ProtectedRoute>
                        <Requirements />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ask"
                    element={
                      <ProtectedRoute>
                        <AskQuestion />
                      </ProtectedRoute>
                    }
                  />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </OnboardingProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
