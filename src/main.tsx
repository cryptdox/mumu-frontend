import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import { queryClient } from "@/lib/query";
import { AuthProvider } from "@/lib/auth";
import "@/lib/theme";
import { ConfirmHost, Toaster } from "@/components/ui";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import App from "./App";
import "./index.css";

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster />
          <ConfirmHost />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
