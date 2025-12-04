import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

// Mock Supabase client
const mockOrder = vi.fn();
const mockSelect = vi.fn(() => ({
  order: mockOrder,
}));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => mockFrom(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  generateRequirementsForSource: vi.fn(),
  generateEmbeddings: vi.fn(),
}));

// Import hook after mocks
import { useLegalSources } from "@/hooks/use-legal-sources";

describe("useLegalSources", () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("fetches legal sources successfully", async () => {
    const mockSources = [
      { id: "1", title: "Law 1", content: "Content 1" },
      { id: "2", title: "Law 2", content: "Content 2" },
    ];

    mockOrder.mockResolvedValue({
      data: mockSources,
      error: null,
    });

    const { result } = renderHook(() => useLegalSources(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    // Wait for the query to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.sources).toEqual(mockSources);
    expect(result.current.error).toBeNull();
  });

  it("handles fetch error", async () => {
    const mockError = new Error("Database error");

    mockOrder.mockResolvedValue({
      data: null,
      error: mockError,
    });

    const { result } = renderHook(() => useLegalSources(), { wrapper });

    // Wait for the query to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.sources).toBeUndefined();
  });

  it("provides reload function", async () => {
    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useLegalSources(), { wrapper });

    // Wait for the query to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(typeof result.current.reload).toBe("function");
  });
});
