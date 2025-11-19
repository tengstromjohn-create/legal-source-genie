import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const PdfUploadDialog = () => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [regelverkName, setRegelverkName] = useState("");
  const [typ, setTyp] = useState("lag");
  const [referens, setReferens] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !regelverkName) {
      toast({
        title: "Missing Information",
        description: "Please select a PDF file and enter a regelverk name",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("regelverk_name", regelverkName);
      formData.append("typ", typ);
      if (referens) {
        formData.append("referens", referens);
      }

      // Use fetch directly for FormData file uploads
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/parse-legal-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse PDF');
      }

      const data = await response.json();

      toast({
        title: "Success",
        description: `PDF processing started. Extracted ${data.characters} characters from ${data.pages} pages. Sources will be saved in background.`,
      });

      queryClient.invalidateQueries({ queryKey: ["legal_sources"] });
      setOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to parse PDF",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setRegelverkName("");
    setTyp("lag");
    setReferens("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Legal PDF</DialogTitle>
          <DialogDescription>
            Upload a PDF document to automatically extract and segment legal sources
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">PDF File</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={uploading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="regelverk_name">Regelverk Name *</Label>
            <Input
              id="regelverk_name"
              value={regelverkName}
              onChange={(e) => setRegelverkName(e.target.value)}
              placeholder="e.g., Dataskyddsförordningen"
              disabled={uploading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="typ">Type</Label>
            <Select value={typ} onValueChange={setTyp} disabled={uploading}>
              <SelectTrigger id="typ">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lag">Lag</SelectItem>
                <SelectItem value="förordning">Förordning</SelectItem>
                <SelectItem value="föreskrift">Föreskrift</SelectItem>
                <SelectItem value="eu-förordning">EU-förordning</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referens">Reference (Optional)</Label>
            <Input
              id="referens"
              value={referens}
              onChange={(e) => setReferens(e.target.value)}
              placeholder="e.g., SFS 2018:218"
              disabled={uploading}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={uploading || !file || !regelverkName}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Parse
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};