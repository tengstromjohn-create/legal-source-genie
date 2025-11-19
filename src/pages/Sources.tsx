import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Loader2, Sparkles, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PdfUploadDialog } from "@/components/PdfUploadDialog";

const Sources = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [regelverkName, setRegelverkName] = useState("");
  const [lagrum, setLagrum] = useState("");
  const [typ, setTyp] = useState("");
  const [referens, setReferens] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const { data: sources, isLoading } = useQuery({
    queryKey: ["legal_sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_source")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newSource: any) => {
      const { data, error } = await supabase
        .from("legal_source")
        .insert([newSource])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal_sources"] });
      toast({
        title: "Success",
        description: "Legal source created successfully",
      });
    setTitle("");
    setContent("");
    setRegelverkName("");
    setLagrum("");
    setTyp("");
    setReferens("");
    setIsFormOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and content are required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      title,
      content,
      full_text: content,
      regelverk_name: regelverkName || null,
      lagrum: lagrum || null,
      typ: typ || null,
      referens: referens || null,
    });
  };

  const handleGenerateRequirements = async (sourceId: string) => {
    setGeneratingId(sourceId);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-requirements', {
        body: { legal_source_id: sourceId }
      });

      if (error) throw error;

      const inserted = data?.inserted || 0;
      toast({
        title: "Krav skapade",
        description: `${inserted} krav har extraherats från dokumentet`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["legal_sources"] });
    } catch (error: any) {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte generera krav",
        variant: "destructive",
      });
    } finally {
      setGeneratingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Legal Sources</h1>
              <p className="text-muted-foreground mt-1">Manage and analyze legal documents</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate("/requirements")} className="gap-2">
                <FileText className="h-4 w-4" />
                Visa Krav
              </Button>
              {isAdmin && (
                <>
                  <PdfUploadDialog />
                  <Button onClick={() => setIsFormOpen(!isFormOpen)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Source
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={signOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isFormOpen && isAdmin && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Create New Legal Source</CardTitle>
              <CardDescription>Add a new legal document to analyze</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="title" className="text-sm font-medium text-foreground block mb-2">
                    Title
                  </label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., GDPR Article 32"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="regelverk" className="text-sm font-medium text-foreground block mb-2">
                      Regelverk (Optional)
                    </label>
                    <Input
                      id="regelverk"
                      value={regelverkName}
                      onChange={(e) => setRegelverkName(e.target.value)}
                      placeholder="e.g., GDPR, ISO 27001"
                    />
                  </div>

                  <div>
                    <label htmlFor="lagrum" className="text-sm font-medium text-foreground block mb-2">
                      Lagrum (Optional)
                    </label>
                    <Input
                      id="lagrum"
                      value={lagrum}
                      onChange={(e) => setLagrum(e.target.value)}
                      placeholder="e.g., Art. 32, § 5"
                    />
                  </div>

                  <div>
                    <label htmlFor="typ" className="text-sm font-medium text-foreground block mb-2">
                      Typ (Optional)
                    </label>
                    <select
                      id="typ"
                      value={typ}
                      onChange={(e) => setTyp(e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Välj typ</option>
                      <option value="lag">Lag</option>
                      <option value="förordning">Förordning</option>
                      <option value="direktiv">Direktiv</option>
                      <option value="föreskrift">Föreskrift</option>
                      <option value="vägledning">Vägledning</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="referens" className="text-sm font-medium text-foreground block mb-2">
                      Referens (Optional)
                    </label>
                    <Input
                      id="referens"
                      value={referens}
                      onChange={(e) => setReferens(e.target.value)}
                      placeholder="e.g., SFS 2018:218"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="content" className="text-sm font-medium text-foreground block mb-2">
                    Legal Text
                  </label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste the legal text here..."
                    rows={8}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Source
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : sources && sources.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sources.map((source) => (
              <Card key={source.id} className="h-full transition-all hover:shadow-lg hover:border-primary">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to={`/sources/${source.id}`}>
                        <CardTitle className="text-lg line-clamp-2 hover:text-primary cursor-pointer">
                          {source.title}
                        </CardTitle>
                      </Link>
                      <CardDescription className="mt-1">
                        {new Date(source.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {source.content}
                  </p>
                  {isAdmin && (
                    <Button
                      onClick={() => handleGenerateRequirements(source.id)}
                      disabled={generatingId === source.id}
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                    >
                      {generatingId === source.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Genererar...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generera krav
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No legal sources yet</h3>
              <p className="text-muted-foreground mb-4">
                {isAdmin 
                  ? "Create your first legal source to get started"
                  : "No legal sources available. Contact an administrator."}
              </p>
              {isAdmin && (
                <Button onClick={() => setIsFormOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Source
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Sources;
