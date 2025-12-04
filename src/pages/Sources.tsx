import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { GenerationProgressDialog, SourceProgress } from "@/components/GenerationProgressDialog";
import { useLegalSources } from "@/hooks/use-legal-sources";
import { SourcesHeader, SourcesList, SourceForm } from "@/components/sources";

const Sources = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [progressSources, setProgressSources] = useState<SourceProgress[]>([]);
  const [progressIndex, setProgressIndex] = useState(0);
  
  const { toast } = useToast();
  const { isAdmin, signOut } = useAuth();
  
  const { 
    sources, 
    isLoading, 
    createSource, 
    isCreating,
    generateRequirements,
    generateEmbeddings,
  } = useLegalSources();

  const handleGenerateRequirements = async (sourceId: string) => {
    const source = sources?.find(s => s.id === sourceId);
    if (!source) return;
    
    setProgressSources([{
      id: source.id,
      title: source.title,
      status: "processing",
    }]);
    setProgressIndex(0);
    setGeneratingId(sourceId);
    
    try {
      const result = await generateRequirements(sourceId);
      
      setProgressSources([{
        id: source.id,
        title: source.title,
        status: "completed",
        requirementsCount: result.inserted,
      }]);
      setProgressIndex(1);
      
      setTimeout(() => {
        toast({
          title: "Krav skapade",
          description: `${result.inserted} krav har extraherats från dokumentet`,
        });
        setProgressSources([]);
      }, 1500);
    } catch (error: any) {
      setProgressSources([{
        id: source.id,
        title: source.title,
        status: "failed",
        error: error.message || "Kunde inte generera krav",
      }]);
      setProgressIndex(1);
      
      setTimeout(() => {
        toast({
          title: "Fel",
          description: error.message || "Kunde inte generera krav",
          variant: "destructive",
        });
        setProgressSources([]);
      }, 1500);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleBatchGenerate = async () => {
    if (selectedSources.size === 0) {
      toast({
        title: "Ingen källa vald",
        description: "Välj minst en källa för att generera krav",
        variant: "destructive",
      });
      return;
    }

    const sourcesToProcess = sources?.filter(s => selectedSources.has(s.id)) || [];
    const initialProgress: SourceProgress[] = sourcesToProcess.map(s => ({
      id: s.id,
      title: s.title,
      status: "pending" as const,
    }));
    
    setProgressSources(initialProgress);
    setProgressIndex(0);
    setIsBatchGenerating(true);

    let successCount = 0;
    let totalInserted = 0;
    const sourceArray = Array.from(selectedSources);

    for (let i = 0; i < sourceArray.length; i++) {
      const sourceId = sourceArray[i];
      
      setProgressSources(prev => prev.map(s => 
        s.id === sourceId ? { ...s, status: "processing" as const } : s
      ));
      
      try {
        const result = await generateRequirements(sourceId);
        totalInserted += result.inserted;
        successCount++;
        
        setProgressSources(prev => prev.map(s => 
          s.id === sourceId 
            ? { ...s, status: "completed" as const, requirementsCount: result.inserted }
            : s
        ));
      } catch (error: any) {
        console.error(`Failed to generate for ${sourceId}:`, error);
        
        setProgressSources(prev => prev.map(s => 
          s.id === sourceId 
            ? { ...s, status: "failed" as const, error: error.message || "Okänt fel" }
            : s
        ));
      }
      
      setProgressIndex(i + 1);
    }

    setTimeout(() => {
      setIsBatchGenerating(false);
      setSelectedSources(new Set());
      setProgressSources([]);
      setProgressIndex(0);

      toast({
        title: "Batch-generering klar",
        description: `${totalInserted} krav skapade från ${successCount} av ${sourceArray.length} källor`,
      });
    }, 1500);
  };

  const toggleSourceSelection = (sourceId: string) => {
    setSelectedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sourceId)) {
        newSet.delete(sourceId);
      } else {
        newSet.add(sourceId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedSources.size === sources?.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(sources?.map(s => s.id) || []));
    }
  };

  const handleGenerateEmbeddings = async () => {
    setIsGeneratingEmbeddings(true);
    
    try {
      const result = await generateEmbeddings(50);
      
      toast({
        title: "Embeddings skapade",
        description: `${result.updated} av ${result.total} källor har fått embeddings`,
      });
    } catch (error: any) {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte generera embeddings",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SourcesHeader
        isAdmin={isAdmin}
        sourcesCount={sources?.length || 0}
        selectedCount={selectedSources.size}
        isGeneratingEmbeddings={isGeneratingEmbeddings}
        isBatchGenerating={isBatchGenerating}
        onGenerateEmbeddings={handleGenerateEmbeddings}
        onToggleSelectAll={toggleSelectAll}
        onBatchGenerate={handleBatchGenerate}
        onOpenForm={() => setIsFormOpen(true)}
        onSignOut={signOut}
      />

      <main className="container mx-auto px-4 py-8">
        {isFormOpen && isAdmin && (
          <SourceForm
            isCreating={isCreating}
            onSubmit={createSource}
            onCancel={() => setIsFormOpen(false)}
          />
        )}

        <SourcesList
          sources={sources}
          isLoading={isLoading}
          isAdmin={isAdmin}
          selectedSources={selectedSources}
          generatingId={generatingId}
          isBatchGenerating={isBatchGenerating}
          onToggleSelection={toggleSourceSelection}
          onGenerateRequirements={handleGenerateRequirements}
          onOpenForm={() => setIsFormOpen(true)}
        />
      </main>

      <GenerationProgressDialog
        open={isBatchGenerating || progressSources.length > 0}
        sources={progressSources}
        currentIndex={progressIndex}
      />
    </div>
  );
};

export default Sources;
