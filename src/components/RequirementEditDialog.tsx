import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Requirement {
  id: string;
  titel: string | null;
  beskrivning: string | null;
  lagrum: string | null;
  subjekt: any;
  trigger: any;
  undantag: any;
  obligation: string | null;
  åtgärder: any;
  risknivå: string | null;
}

interface RequirementEditDialogProps {
  requirement: Requirement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const RequirementEditDialog = ({
  requirement,
  open,
  onOpenChange,
  onSuccess,
}: RequirementEditDialogProps) => {
  const [titel, setTitel] = useState(requirement.titel || "");
  const [beskrivning, setBeskrivning] = useState(requirement.beskrivning || "");
  const [lagrum, setLagrum] = useState(requirement.lagrum || "");
  const [subjekt, setSubjekt] = useState(
    Array.isArray(requirement.subjekt) ? requirement.subjekt.join(", ") : ""
  );
  const [trigger, setTrigger] = useState(
    Array.isArray(requirement.trigger) ? requirement.trigger.join(", ") : ""
  );
  const [undantag, setUndantag] = useState(
    Array.isArray(requirement.undantag) ? requirement.undantag.join(", ") : ""
  );
  const [obligation, setObligation] = useState(requirement.obligation || "");
  const [åtgärder, setÅtgärder] = useState(
    Array.isArray(requirement.åtgärder) ? requirement.åtgärder.join(", ") : ""
  );
  const [risknivå, setRisknivå] = useState(requirement.risknivå || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("requirement")
        .update({
          titel,
          beskrivning,
          lagrum,
          subjekt: subjekt.split(",").map((s) => s.trim()).filter(Boolean),
          trigger: trigger.split(",").map((t) => t.trim()).filter(Boolean),
          undantag: undantag.split(",").map((u) => u.trim()).filter(Boolean),
          obligation,
          åtgärder: åtgärder.split(",").map((a) => a.trim()).filter(Boolean),
          risknivå,
        })
        .eq("id", requirement.id);

      if (error) throw error;

      toast({
        title: "Sparat",
        description: "Kravet har uppdaterats",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Fel",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Redigera krav</DialogTitle>
          <DialogDescription>
            Granska och ändra kravet enligt behov
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="titel">Titel</Label>
            <Input
              id="titel"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Titel på kravet"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="beskrivning">Beskrivning</Label>
            <Textarea
              id="beskrivning"
              value={beskrivning}
              onChange={(e) => setBeskrivning(e.target.value)}
              placeholder="Detaljerad beskrivning"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lagrum">Paragraf/Lagrum</Label>
            <Input
              id="lagrum"
              value={lagrum}
              onChange={(e) => setLagrum(e.target.value)}
              placeholder="t.ex. 8 kap. 18 §, Art. 32"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subjekt">Subjekt (kommaseparerade)</Label>
              <Input
                id="subjekt"
                value={subjekt}
                onChange={(e) => setSubjekt(e.target.value)}
                placeholder="t.ex. aktieägare, styrelse"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="obligation">Obligation</Label>
              <Input
                id="obligation"
                value={obligation}
                onChange={(e) => setObligation(e.target.value)}
                placeholder="t.ex. ska, måste, bör"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trigger">Trigger/Händelser (kommaseparerade)</Label>
            <Textarea
              id="trigger"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="t.ex. bildande av bolag, beslut på stämma"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="åtgärder">Åtgärder (kommaseparerade)</Label>
            <Textarea
              id="åtgärder"
              value={åtgärder}
              onChange={(e) => setÅtgärder(e.target.value)}
              placeholder="t.ex. registrering, anmälan"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="undantag">Undantag (kommaseparerade)</Label>
            <Textarea
              id="undantag"
              value={undantag}
              onChange={(e) => setUndantag(e.target.value)}
              placeholder="t.ex. om bolagsstämman beslutar annat"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="risknivå">Risknivå</Label>
            <select
              id="risknivå"
              value={risknivå}
              onChange={(e) => setRisknivå(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value="">Välj risknivå</option>
              <option value="låg">Låg</option>
              <option value="medel">Medel</option>
              <option value="hög">Hög</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Spara
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
