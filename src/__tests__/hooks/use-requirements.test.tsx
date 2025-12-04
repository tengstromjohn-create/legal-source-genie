import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

// Mock the API layer
const mockFetchAllRequirements = vi.fn();
const mockFetchRequirementsBySource = vi.fn();

vi.mock("@/lib/api/requirements", () => ({
  fetchAllRequirements: () => mockFetchAllRequirements(),
  fetchRequirementsBySource: (sourceId: string) => mockFetchRequirementsBySource(sourceId),
  updateRequirement: vi.fn(),
  deleteRequirement: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Import hooks after mocks
import { useRequirements, useRequirementsBySource } from "@/hooks/use-requirements";

describe("useRequirements", () => {
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

  it("fetches all requirements successfully", async () => {
    const mockRequirements = [
      { id: "req-1", title: "Requirement 1", legal_source_id: "source-1" },
      { id: "req-2", title: "Requirement 2", legal_source_id: "source-2" },
    ];

    mockFetchAllRequirements.mockResolvedValue(mockRequirements);

    const { result } = renderHook(() => useRequirements(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.requirements).toEqual(mockRequirements);
    expect(result.current.error).toBeNull();
  });

  it("handles fetch error", async () => {
    const mockError = new Error("API error");
    mockFetchAllRequirements.mockRejectedValue(mockError);

    const { result } = renderHook(() => useRequirements(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.requirements).toBeUndefined();
  });

  it("provides delete mutation", async () => {
    mockFetchAllRequirements.mockResolvedValue([]);

    const { result } = renderHook(() => useRequirements(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(typeof result.current.deleteRequirement).toBe("function");
    expect(result.current.isDeleting).toBe(false);
  });
});

describe("useRequirementsBySource", () => {
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

  it("fetches requirements for specific source", async () => {
    const sourceId = "source-123";
    const mockRequirements = [
      { id: "req-1", title: "Requirement 1", legal_source_id: sourceId },
    ];

    mockFetchRequirementsBySource.mockResolvedValue(mockRequirements);

    const { result } = renderHook(() => useRequirementsBySource(sourceId), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(mockFetchRequirementsBySource).toHaveBeenCalledWith(sourceId);
    expect(result.current.requirements).toEqual(mockRequirements);
  });

  it("does not fetch when sourceId is undefined", async () => {
    const { result } = renderHook(() => useRequirementsBySource(undefined), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(mockFetchRequirementsBySource).not.toHaveBeenCalled();
  });
});
