import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, FileText, ArrowLeft, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { RequirementEditDialog } from "@/components/RequirementEditDialog";
import { RequirementCard } from "@/components/requirements/RequirementCard";
import { RequirementsListSkeleton } from "@/components/ui/skeletons";
import { DemoBanner } from "@/components/layout/DemoBanner";
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
import { useRequirements, type Requirement } from "@/hooks/use-requirements";

const PAGE_SIZE = 20;

const Requirements = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [deleteRequirementId, setDeleteRequirementId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const { 
    requirements, 
    isLoading, 
    deleteRequirement, 
    isDeleting,
    updateRequirement,
    isUpdating,
  } = useRequirements();

  // Memoize filtered requirements
  const filteredRequirements = useMemo(() => {
    if (!requirements) return [];
    if (!searchTerm) return requirements;
    
    const searchLower = searchTerm.toLowerCase();
    return requirements.filter((req) => (
      req.titel?.toLowerCase().includes(searchLower) ||
      req.beskrivning?.toLowerCase().includes(searchLower) ||
      req.legalSource?.title?.toLowerCase().includes(searchLower) ||
      req.legalSource?.lagrum?.toLowerCase().includes(searchLower)
    ));
  }, [requirements, searchTerm]);

  // Paginate locally
  const visibleRequirements = useMemo(() => {
    return filteredRequirements.slice(0, visibleCount);
  }, [filteredRequirements, visibleCount]);

  const hasMore = visibleCount < filteredRequirements.length;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  }, []);

  const handleDelete = useCallback(() => {
    if (deleteRequirementId) {
      deleteRequirement(deleteRequirementId, {
        onSuccess: () => setDeleteRequirementId(null),
      });
    }
  }, [deleteRequirementId, deleteRequirement]);

  const handleSaveRequirement = useCallback(async (id: string, updates: Parameters<typeof updateRequirement>[1]) => {
    await updateRequirement(id, updates);
    setSelectedRequirement(null);
  }, [updateRequirement]);

  const handleEdit = useCallback((req: Requirement) => {
    setSelectedRequirement(req);
  }, []);

  const handleRequestDelete = useCallback((id: string) => {
    setDeleteRequirementId(id);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/sources")}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Krav</h1>
                  <p className="text-muted-foreground mt-1">Granska och redigera genererade krav</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <RequirementsListSkeleton count={5} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/sources")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Krav</h1>
                <p className="text-muted-foreground mt-1">Granska och redigera genererade krav</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate("/ask")} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Ställ fråga
              </Button>
              <span className="text-sm text-muted-foreground">
                {filteredRequirements.length} krav
              </span>
            </div>
          </div>
        </div>
      </header>

      <DemoBanner />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sök efter titel, beskrivning eller lagrum..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setVisibleCount(PAGE_SIZE); // Reset pagination on search
              }}
              className="pl-10"
            />
          </div>
        </div>

        {filteredRequirements.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                {searchTerm
                  ? "Inga krav matchade din sökning"
                  : "Inga krav har genererats än"}
              </p>
              {!searchTerm && (
                <Button variant="outline" className="mt-4" onClick={() => navigate("/sources")}>
                  Gå till Källor
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {visibleRequirements.map((req) => (
            <RequirementCard
              key={req.id}
              requirement={req}
              isAdmin={isAdmin}
              onEdit={handleEdit}
              onDelete={handleRequestDelete}
            />
          ))}
        </div>

        {hasMore && (
          <div className="flex justify-center mt-6">
            <Button variant="outline" onClick={handleLoadMore}>
              Visa fler ({filteredRequirements.length - visibleCount} kvar)
            </Button>
          </div>
        )}
      </main>

      {selectedRequirement && (
        <RequirementEditDialog
          requirement={selectedRequirement}
          open={!!selectedRequirement}
          onOpenChange={(open) => !open && setSelectedRequirement(null)}
          onSave={handleSaveRequirement}
          isSaving={isUpdating}
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
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Tar bort..." : "Ta bort"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Requirements;
