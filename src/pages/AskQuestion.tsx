import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, FileText, ArrowLeft, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Match {
  id: string;
  title: string;
  lagrum: string;
  similarity: number;
  regelverk_name?: string;
}

const AskQuestion = () => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) {
      toast({
        variant: "destructive",
        title: "Fråga saknas",
        description: "Vänligen ange en fråga",
      });
      return;
    }

    setLoading(true);
    setAnswer("");
    setMatches([]);

    try {
      const { data, error } = await supabase.functions.invoke('ask-legal-question', {
        body: { question },
      });

      if (error) throw error;

      setAnswer(data.answer);
      setMatches(data.matches || []);

      toast({
        title: "Svar genererat",
        description: "Ditt juridiska svar har genererats baserat på relevanta lagrum",
      });
    } catch (error) {
      console.error('Error asking question:', error);
      toast({
        variant: "destructive",
        title: "Fel vid fråga",
        description: error instanceof Error ? error.message : "Ett oväntat fel uppstod",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
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
                <h1 className="text-3xl font-bold text-foreground">Juridisk Frågeassistent</h1>
                <p className="text-muted-foreground mt-1">
                  Ställ frågor om regelverken och få svar baserat på lagtext med AI
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">

        <Card>
          <CardHeader>
            <CardTitle>Ställ din fråga</CardTitle>
            <CardDescription>
              AI:n söker efter relevanta lagrum och svarar baserat på den faktiska lagtexten
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="T.ex. Vilka krav ställs på riskhantering enligt regelverket?"
                className="min-h-[120px]"
                disabled={loading}
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Söker och genererar svar...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Skicka fråga
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {answer && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Svar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="whitespace-pre-wrap">{answer}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {matches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Relevanta lagrum ({matches.length})
              </CardTitle>
              <CardDescription>
                Dessa källor användes för att besvara din fråga
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {matches.map((match) => (
                <Alert key={match.id}>
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-semibold">{match.title}</div>
                      {match.lagrum && (
                        <div className="text-sm text-muted-foreground">
                          Lagrum: {match.lagrum}
                        </div>
                      )}
                      {match.regelverk_name && (
                        <div className="text-sm text-muted-foreground">
                          Regelverk: {match.regelverk_name}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Relevans: {(match.similarity * 100).toFixed(1)}%
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        )}
        </div>
      </main>
    </div>
  );
};

export default AskQuestion;
