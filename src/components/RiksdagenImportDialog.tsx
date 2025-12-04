import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Search, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRiksdagenSearch, RiksdagenDocument } from "@/hooks/use-riksdagen-search";

export const RiksdagenImportDialog = () => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [importing, setImporting] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { results, isLoading, error, search, reset, removeResult } = useRiksdagenSearch();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchTerm.trim()) {
      toast({
        title: "Saknar sökord",
        description: "Ange ett sökord för att söka",
        variant: "destructive",
      });
      return;
    }

    await search({ query: searchTerm });
  };

  // Show toast when error occurs
  useEffect(() => {
    if (error) {
      toast({
        title: "Sökfel",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleImport = async (doc: RiksdagenDocument) => {
    setImporting(doc.dok_id);

    try {
      // Fetch the full text content
      let content = "";
      
      if (doc.dokument_url_text) {
        const textResponse = await fetch(doc.dokument_url_text);
        if (textResponse.ok) {
          content = await textResponse.text();
        }
      }

      if (!content && doc.dokument_url_html) {
        const htmlResponse = await fetch(doc.dokument_url_html);
        if (htmlResponse.ok) {
          const htmlText = await htmlResponse.text();
          // Simple HTML to text conversion
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = htmlText;
          content = tempDiv.textContent || tempDiv.innerText || "";
        }
      }

      if (!content) {
        throw new Error("Kunde inte hämta dokumentets innehåll");
      }

      // Create the legal source
      const { error } = await supabase.from("legal_source").insert({
        title: doc.beteckning || doc.titel,
        content: content.substring(0, 5000),
        full_text: content,
        regelverk_name: "SFS",
        lagrum: doc.beteckning,
        typ: "lag",
        referens: doc.beteckning,
      });

      if (error) throw error;

      toast({
        title: "Import lyckades",
        description: `${doc.beteckning} har importerats`,
      });

      queryClient.invalidateQueries({ queryKey: ["legal_sources"] });
      removeResult(doc.dok_id);
      
    } catch (error: any) {
      toast({
        title: "Import misslyckades",
        description: error.message || "Kunde inte importera dokumentet",
        variant: "destructive",
      });
    } finally {
      setImporting(null);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearchTerm("");
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Importera från Riksdagen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importera från Riksdagen</DialogTitle>
          <DialogDescription>
            Sök och importera lagar direkt från Riksdagens öppna data (SFS - Svensk författningssamling)
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="search">Sök lagtext</Label>
              <Input
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="t.ex. aktiebolagslag, dataskydd, GDPR..."
                disabled={isLoading}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={isLoading || !searchTerm.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Söker...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Sök
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        {results.length > 0 && (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3">
              {results.map((doc) => (
                <Card key={doc.dok_id} className="transition-all hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base line-clamp-2">
                          {doc.beteckning}
                        </CardTitle>
                        <CardDescription className="mt-1 line-clamp-2">
                          {doc.titel}
                        </CardDescription>
                      </div>
                      {doc.dokument_url_html && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a
                            href={doc.dokument_url_html}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Publicerad: {new Date(doc.publicerad).toLocaleDateString('sv-SE')}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleImport(doc)}
                        disabled={importing !== null}
                      >
                        {importing === doc.dok_id ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Importerar...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-3 w-3" />
                            Importera
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        {!isLoading && results.length === 0 && searchTerm && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Sök efter lagar i Riksdagens databas
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
