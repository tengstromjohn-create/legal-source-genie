import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const SourceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const { user, loading: authLoading, isAdmin } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

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

  if (authLoading || sourceLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
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
                Created {new Date(source.created_at).toLocaleDateString()}
              </p>
            </div>
            {isAdmin && (
              <Button onClick={generateRequirements} disabled={isGenerating} className="gap-2">
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
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Legal Source Content</CardTitle>
                <CardDescription>Original document text</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap text-foreground">{source.content}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Requirements</CardTitle>
                    <CardDescription>
                      {requirements?.length || 0} requirement(s) extracted
                    </CardDescription>
                  </div>
                  {requirements && requirements.length > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Analyzed
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {requirementsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : requirements && requirements.length > 0 ? (
                  <div className="space-y-4">
                    {requirements.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors"
                      >
                        <h4 className="font-semibold text-foreground mb-2">{req.title}</h4>
                        {req.description && (
                          <p className="text-sm text-muted-foreground">{req.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-4">
                      No requirements generated yet
                    </p>
                    <Button onClick={generateRequirements} disabled={isGenerating} variant="outline">
                      Generate Requirements with AI
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SourceDetail;
