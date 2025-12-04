import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

interface EditableRequirement {
  id: string;
  titel: string;
  beskrivning: string;
  obligation: string;
  risknivå: string;
}

const SourceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const { isAdmin } = useAuth();
  const [editedRequirements, setEditedRequirements] = useState<Record<string, EditableRequirement>>({});

  const { data: source, isLoading: sourceLoading } = useQuery({
    queryKey: ["legal_source", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_source")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: requirements, isLoading: requirementsLoading } = useQuery({
    queryKey: ["requirements", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requirement")
        .select("*")
        .eq("legal_source_id", id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const generateRequirements = async () => {
    if (!id) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-requirements", {
        body: { legal_source_id: id },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Generated ${data.count} requirements`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["requirements", id] });
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

  const updateRequirement = useMutation({
    mutationFn: async ({ requirementId, updates }: { requirementId: string; updates: Partial<EditableRequirement> }) => {
      const { error } = await supabase
        .from("requirement")
        .update(updates)
        .eq("id", requirementId);
      
      if (error) throw error;
    },
    onSuccess: (_, { requirementId }) => {
      toast({
        title: "Success",
        description: "Requirement updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["requirements", id] });
      setEditedRequirements((prev) => {
        const updated = { ...prev };
        delete updated[requirementId];
        return updated;
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update requirement",
        variant: "destructive",
      });
    },
  });

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
      updateRequirement.mutate({ requirementId, updates });
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
                {source.regelverk_name && (
                  <Badge variant="outline" className="mr-2">
                    {source.regelverk_name}
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
                {source.full_text || source.content}
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
                  onClick={generateRequirements}
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
                                disabled={!hasChanges || updateRequirement.isPending}
                                variant={hasChanges ? "default" : "ghost"}
                                className="gap-2"
                              >
                                {updateRequirement.isPending ? (
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
