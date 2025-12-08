import { createContext, useContext, ReactNode } from "react";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useDemoData } from "@/hooks/use-demo-data";

interface OnboardingContextType {
  showOnboarding: boolean;
  resetOnboarding: () => void;
  loadDemoData: () => Promise<boolean>;
  isDemoLoading: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const useOnboardingContext = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboardingContext must be used within OnboardingProvider");
  }
  return context;
};

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { showOnboarding, completeOnboarding, resetOnboarding, isLoading } = useOnboarding();
  const { loadDemoData, isLoading: isDemoLoading } = useDemoData();

  const handleLoadDemo = async () => {
    await loadDemoData();
  };

  if (isLoading) {
    return null; // Or a loading spinner
  }

  return (
    <OnboardingContext.Provider
      value={{
        showOnboarding,
        resetOnboarding,
        loadDemoData,
        isDemoLoading,
      }}
    >
      {children}
      <OnboardingModal
        open={showOnboarding}
        onComplete={completeOnboarding}
        onLoadDemo={handleLoadDemo}
      />
    </OnboardingContext.Provider>
  );
}
