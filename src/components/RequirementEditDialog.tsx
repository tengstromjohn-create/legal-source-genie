import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
import type { UpdateRequirementInput, Requirement, RiskLevel } from "@/types/domain";

interface RequirementEditDialogProps {
  requirement: Requirement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: UpdateRequirementInput) => Promise<void>;
  isSaving?: boolean;
}

export const RequirementEditDialog = ({
  requirement,
  open,
  onOpenChange,
  onSave,
  isSaving = false,
}: RequirementEditDialogProps) => {
  const [titel, setTitel] = useState("");
  const [beskrivning, setBeskrivning] = useState("");
  const [subjekt, setSubjekt] = useState("");
  const [triggers, setTriggers] = useState("");
  const [undantag, setUndantag] = useState("");
  const [obligation, setObligation] = useState("");
  const [åtgärder, setÅtgärder] = useState("");
  const [risknivå, setRisknivå] = useState("");

  useEffect(() => {
    setTitel(requirement.titel || "");
    setBeskrivning(requirement.beskrivning || "");
    setSubjekt(requirement.subjekt?.join(", ") || "");
    setTriggers(requirement.triggers?.join(", ") || "");
    setUndantag(requirement.undantag?.join(", ") || "");
    setObligation(requirement.obligation || "");
    setÅtgärder(requirement.åtgärder?.join(", ") || "");
    setRisknivå(requirement.risknivå || "");
  }, [requirement]);

  const handleSave = async () => {
    const updates: UpdateRequirementInput = {
      titel,
      beskrivning,
      subjekt: subjekt.split(",").map((s) => s.trim()).filter(Boolean),
      triggers: triggers.split(",").map((t) => t.trim()).filter(Boolean),
      undantag: undantag.split(",").map((u) => u.trim()).filter(Boolean),
      obligation,
      åtgärder: åtgärder.split(",").map((a) => a.trim()).filter(Boolean),
      risknivå: risknivå as RiskLevel || undefined,
    };
    
    await onSave(requirement.id, updates);
    onOpenChange(false);
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
            <Label htmlFor="triggers">Trigger/Händelser (kommaseparerade)</Label>
            <Textarea
              id="triggers"
              value={triggers}
              onChange={(e) => setTriggers(e.target.value)}
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
              <option value="kritisk">Kritisk</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Spara
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
