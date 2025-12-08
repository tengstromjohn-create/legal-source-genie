import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

const ONBOARDING_COMPLETED_KEY = "lsg_onboarding_completed";

export function useOnboarding() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Check if user has completed onboarding
    const completedUsers = JSON.parse(
      localStorage.getItem(ONBOARDING_COMPLETED_KEY) || "[]"
    ) as string[];
    
    const hasCompleted = completedUsers.includes(user.id);
    setShowOnboarding(!hasCompleted);
    setIsLoading(false);
  }, [user]);

  const completeOnboarding = useCallback(() => {
    if (!user) return;

    const completedUsers = JSON.parse(
      localStorage.getItem(ONBOARDING_COMPLETED_KEY) || "[]"
    ) as string[];
    
    if (!completedUsers.includes(user.id)) {
      completedUsers.push(user.id);
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, JSON.stringify(completedUsers));
    }
    
    setShowOnboarding(false);
  }, [user]);

  const resetOnboarding = useCallback(() => {
    if (!user) return;

    const completedUsers = JSON.parse(
      localStorage.getItem(ONBOARDING_COMPLETED_KEY) || "[]"
    ) as string[];
    
    const filtered = completedUsers.filter((id: string) => id !== user.id);
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, JSON.stringify(filtered));
    setShowOnboarding(true);
  }, [user]);

  return {
    showOnboarding,
    isLoading,
    completeOnboarding,
    resetOnboarding,
  };
}
