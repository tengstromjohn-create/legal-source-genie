import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock all the hooks before importing the component
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-123", email: "test@example.com" },
    loading: false,
    isAdmin: true,
  }),
}));

vi.mock("@/hooks/use-legal-sources", () => ({
  useLegalSources: () => ({
    sources: [
      {
        id: "source-1",
        title: "Test Law 1",
        content: "Content 1",
        regelverk_name: "SFS",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        embedding: null,
      },
      {
        id: "source-2",
        title: "Test Law 2",
        content: "Content 2",
        regelverk_name: "EU",
        created_at: "2024-01-02T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        embedding: "has-embedding",
      },
    ],
    isLoading: false,
    error: null,
    reload: vi.fn(),
    createSource: vi.fn(),
    isCreating: false,
    generateRequirements: vi.fn(),
    generateEmbeddings: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Import component after mocks are set up
import Sources from "@/pages/Sources";

describe("Sources Page", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("renders the sources page with header", () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Sources />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(container.textContent).toContain("Rättskällor");
  });

  it("displays the list of legal sources", () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Sources />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(container.textContent).toContain("Test Law 1");
    expect(container.textContent).toContain("Test Law 2");
  });

  it("shows the correct number of sources in badge", () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Sources />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Should contain "2" somewhere (the count badge)
    const badges = container.querySelectorAll('[class*="badge"]');
    const badgeTexts = Array.from(badges).map((b: Element) => b.textContent);
    expect(badgeTexts.some((t: string | null) => t?.includes("2"))).toBe(true);
  });
});
