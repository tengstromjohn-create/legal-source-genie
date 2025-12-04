import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Sparkles, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLegalSource, useLegalSources } from "@/hooks/use-legal-sources";
import { useRequirementsBySource } from "@/hooks/use-requirements";

import { RiskLevel } from "@/types/domain";

interface EditableRequirement {
  id: string;
  titel: string;
  beskrivning: string;
  obligation: string;
  risknivå: RiskLevel | "";
}

const SourceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const { isAdmin } = useAuth();
  const [editedRequirements, setEditedRequirements] = useState<Record<string, EditableRequirement>>({});

  const { source, isLoading: sourceLoading } = useLegalSource(id);
  const { generateRequirements } = useLegalSources();
  const { 
    requirements, 
    isLoading: requirementsLoading, 
    updateRequirement,
    isUpdating,
    reload: reloadRequirements,
  } = useRequirementsBySource(id);

  const handleGenerateRequirements = async () => {
    if (!id) return;
    
    setIsGenerating(true);
    try {
      const result = await generateRequirements(id);

      toast({
        title: "Success",
        description: `Generated ${result.inserted} requirements`,
      });
      
      reloadRequirements();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate requirements",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFieldChange = (requirementId: string, field: keyof EditableRequirement, value: string) => {
    setEditedRequirements((prev) => ({
      ...prev,
      [requirementId]: {
        ...prev[requirementId],
        id: requirementId,
        [field]: value,
      },
    }));
  };

  const handleSave = (requirementId: string) => {
    const updates = editedRequirements[requirementId];
    if (updates) {
      const { id: _, risknivå, ...rest } = updates;
      updateRequirement(requirementId, {
        ...rest,
        risknivå: risknivå || undefined,
      });
      setEditedRequirements((prev) => {
        const updated = { ...prev };
        delete updated[requirementId];
        return updated;
      });
    }
  };

  if (sourceLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!source) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Legal source not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/sources">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Sources
              </Button>
            </Link>
          </div>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-2">{source.title}</h1>
              <p className="text-muted-foreground">
                {source.regelverkName && (
                  <Badge variant="outline" className="mr-2">
                    {source.regelverkName}
                  </Badge>
                )}
                {source.lagrum && (
                  <Badge variant="secondary">
                    {source.lagrum}
                  </Badge>
                )}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl">Legal Source Text</CardTitle>
            <CardDescription>Full text of the legal source</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none bg-muted/50 p-6 rounded-lg">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {source.fullText || source.content}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Requirements</CardTitle>
                <CardDescription>
                  {requirementsLoading ? (
                    "Loading requirements..."
                  ) : (
                    `${requirements?.length || 0} requirement(s) found`
                  )}
                </CardDescription>
              </div>
              {isAdmin && (
                <Button 
                  onClick={handleGenerateRequirements}
                  disabled={isGenerating}
                  className="gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Requirements
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {requirementsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : requirements && requirements.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Titel</TableHead>
                      <TableHead className="w-[300px]">Beskrivning</TableHead>
                      <TableHead className="w-[200px]">Obligation</TableHead>
                      <TableHead className="w-[150px]">Risknivå</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requirements.map((req) => {
                      const edited = editedRequirements[req.id];
                      const hasChanges = !!edited;
                      
                      return (
                        <TableRow key={req.id}>
                          <TableCell>
                            <Input
                              value={edited?.titel ?? req.titel ?? ""}
                              onChange={(e) => handleFieldChange(req.id, "titel", e.target.value)}
                              className="min-w-[180px]"
                              disabled={!isAdmin}
                            />
                          </TableCell>
                          <TableCell>
                            <Textarea
                              value={edited?.beskrivning ?? req.beskrivning ?? ""}
                              onChange={(e) => handleFieldChange(req.id, "beskrivning", e.target.value)}
                              className="min-w-[280px] min-h-[80px]"
                              disabled={!isAdmin}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={edited?.obligation ?? req.obligation ?? ""}
                              onChange={(e) => handleFieldChange(req.id, "obligation", e.target.value)}
                              className="min-w-[180px]"
                              disabled={!isAdmin}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={edited?.risknivå ?? req.risknivå ?? ""}
                              onValueChange={(value) => handleFieldChange(req.id, "risknivå", value)}
                              disabled={!isAdmin}
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="Select risk" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="låg">Låg</SelectItem>
                                <SelectItem value="medel">Medel</SelectItem>
                                <SelectItem value="hög">Hög</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {isAdmin && (
                              <Button
                                size="sm"
                                onClick={() => handleSave(req.id)}
                                disabled={!hasChanges || isUpdating}
                                variant={hasChanges ? "default" : "ghost"}
                                className="gap-2"
                              >
                                {isUpdating ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No requirements found. Click "Generate Requirements" to extract them from the source.
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SourceDetail;
