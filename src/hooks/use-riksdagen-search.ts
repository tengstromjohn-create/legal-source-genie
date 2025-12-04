import { useState, useCallback } from "react";
import { logError, getUserFriendlyMessage } from "@/lib/error";

export interface RiksdagenDocument {
  dok_id: string;
  titel: string;
  undertitel?: string;
  notisrubrik?: string;
  publicerad: string;
  doktyp: string;
  rm: string;
  beteckning: string;
  dokument_url_html?: string;
  dokument_url_text?: string;
}

interface RiksdagenApiResponse {
  dokumentlista: {
    dokument: RiksdagenDocument | RiksdagenDocument[];
    "@traffar": string;
  };
}

export interface RiksdagenSearchParams {
  query: string;
  documentType?: string;
  page?: number;
}

const RIKSDAGEN_BASE_URL = "https://data.riksdagen.se/dokumentlista/";

function buildSearchUrl(params: RiksdagenSearchParams): string {
  const { query, documentType = "sfs", page = 1 } = params;
  const searchParams = new URLSearchParams({
    sok: query,
    doktyp: documentType,
    utformat: "json",
    sort: "rel",
    sortorder: "desc",
    p: page.toString(),
  });
  return `${RIKSDAGEN_BASE_URL}?${searchParams.toString()}`;
}

export function useRiksdagenSearch() {
  const [results, setResults] = useState<RiksdagenDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalHits, setTotalHits] = useState<number>(0);

  const search = useCallback(async (params: RiksdagenSearchParams) => {
    if (!params.query.trim()) {
      setError("Ange ett sökord för att söka");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const url = buildSearchUrl(params);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Kunde inte ansluta till Riksdagens API");
      }

      const data: RiksdagenApiResponse = await response.json();

      if (data.dokumentlista?.dokument) {
        const documents = Array.isArray(data.dokumentlista.dokument)
          ? data.dokumentlista.dokument
          : [data.dokumentlista.dokument];

        setResults(documents);
        setTotalHits(parseInt(data.dokumentlista["@traffar"] || "0", 10));
      } else {
        setResults([]);
        setTotalHits(0);
      }
    } catch (err) {
      logError(err, { component: "useRiksdagenSearch", action: "search", query: params.query });
      const userMessage = getUserFriendlyMessage(err);
      setError(userMessage);
      setResults([]);
      setTotalHits(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResults([]);
    setError(null);
    setTotalHits(0);
  }, []);

  const removeResult = useCallback((dokId: string) => {
    setResults((prev) => prev.filter((d) => d.dok_id !== dokId));
  }, []);

  return {
    results,
    isLoading,
    error,
    totalHits,
    search,
    reset,
    removeResult,
  };
}
