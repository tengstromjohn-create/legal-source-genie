import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, Search, FileText, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { RequirementEditDialog } from "@/components/RequirementEditDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Requirement {
  id: string;
  titel: string | null;
  title: string;
  beskrivning: string | null;
  description: string | null;
  lagrum: string | null;
  subjekt: any;
  trigger: any;
  undantag: any;
  obligation: string | null;
  åtgärder: any;
  risknivå: string | null;
  legal_source_id: string;
  created_at: string;
  legal_source?: {
    title: string;
    regelverk_name: string;
    lagrum: string;
  };
}

const Requirements = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [deleteRequirementId, setDeleteRequirementId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const { data: requirements, isLoading } = useQuery({
    queryKey: ["requirements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requirement")
        .select(`
          *,
          legal_source:legal_source_id (
            title,
            regelverk_name,
            lagrum
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as Requirement[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("requirement")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
      toast({
        title: "Borttaget",
        description: "Kravet har tagits bort",
      });
      setDeleteRequirementId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Fel",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredRequirements = requirements?.filter((req) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (req.titel?.toLowerCase().includes(searchLower) ||
      req.title?.toLowerCase().includes(searchLower) ||
      req.beskrivning?.toLowerCase().includes(searchLower) ||
      req.description?.toLowerCase().includes(searchLower) ||
      req.lagrum?.toLowerCase().includes(searchLower) ||
      req.legal_source?.title?.toLowerCase().includes(searchLower) ||
      req.legal_source?.lagrum?.toLowerCase().includes(searchLower))
    );
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/sources")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Krav</h1>
                <p className="text-muted-foreground mt-1">
                  Granska och redigera genererade krav
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate("/ask")} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Ställ fråga
              </Button>
              <span className="text-sm text-muted-foreground">
                {filteredRequirements?.length || 0} krav
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sök efter titel, beskrivning eller lagrum..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filteredRequirements && filteredRequirements.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                {searchTerm
                  ? "Inga krav matchade din sökning"
                  : "Inga krav har genererats än"}
              </p>
              {!searchTerm && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate("/sources")}
                >
                  Gå till Källor
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {filteredRequirements?.map((req) => (
            <Card key={req.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl">
                      {req.titel || req.title}
                    </CardTitle>
                    <CardDescription className="mt-2 space-y-1">
                      <div>
                        <span className="font-semibold">Källa:</span>{" "}
                        {req.legal_source?.regelverk_name || req.legal_source?.title}
                      </div>
                      {req.lagrum && (
                        <div>
                          <span className="font-semibold">Paragraf:</span>{" "}
                          {req.lagrum}
                        </div>
                      )}
                    </CardDescription>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSelectedRequirement(req)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setDeleteRequirementId(req.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Beskrivning:
                    </p>
                    <p className="text-sm">
                      {req.beskrivning || req.description || "-"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {req.subjekt && Array.isArray(req.subjekt) && req.subjekt.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Subjekt:</p>
                        <p className="text-sm">{req.subjekt.join(", ")}</p>
                      </div>
                    )}

                    {req.obligation && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Obligation:
                        </p>
                        <p className="text-sm">{req.obligation}</p>
                      </div>
                    )}

                    {req.risknivå && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Risknivå:</p>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            req.risknivå === "hög"
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              : req.risknivå === "medel"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          }`}
                        >
                          {req.risknivå}
                        </span>
                      </div>
                    )}
                  </div>

                  {req.trigger && Array.isArray(req.trigger) && req.trigger.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Trigger:</p>
                      <p className="text-sm">{req.trigger.join(", ")}</p>
                    </div>
                  )}

                  {req.åtgärder && Array.isArray(req.åtgärder) && req.åtgärder.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Åtgärder:</p>
                      <p className="text-sm">{req.åtgärder.join(", ")}</p>
                    </div>
                  )}

                  {req.undantag && Array.isArray(req.undantag) && req.undantag.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Undantag:</p>
                      <p className="text-sm">{req.undantag.join(", ")}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {selectedRequirement && (
        <RequirementEditDialog
          requirement={selectedRequirement}
          open={!!selectedRequirement}
          onOpenChange={(open) => !open && setSelectedRequirement(null)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["requirements"] })}
        />
      )}

      <AlertDialog open={!!deleteRequirementId} onOpenChange={(open) => !open && setDeleteRequirementId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort krav?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort detta krav? Detta kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRequirementId && deleteMutation.mutate(deleteRequirementId)}
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Requirements;
