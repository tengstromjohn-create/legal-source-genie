import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CreateLegalSourceInput } from "@/hooks/use-legal-sources";

interface SourceFormProps {
  isCreating: boolean;
  onSubmit: (source: CreateLegalSourceInput, options?: { onSuccess?: () => void }) => void;
  onCancel: () => void;
}

export const SourceForm = ({ isCreating, onSubmit, onCancel }: SourceFormProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [regelverkName, setRegelverkName] = useState("");
  const [lagrum, setLagrum] = useState("");
  const [typ, setTyp] = useState("");
  const [referens, setReferens] = useState("");
  
  const { toast } = useToast();

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
    
    onSubmit({
      title,
      content,
      regelverk_name: regelverkName || null,
      lagrum: lagrum || null,
      typ: typ || null,
      referens: referens || null,
    }, {
      onSuccess: () => {
        setTitle("");
        setContent("");
        setRegelverkName("");
        setLagrum("");
        setTyp("");
        setReferens("");
        onCancel();
      }
    });
  };

  return (
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
            <Button type="submit" disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Source
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
