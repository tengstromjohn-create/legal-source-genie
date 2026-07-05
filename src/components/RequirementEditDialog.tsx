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
import { ExternalLink, Loader2 } from "lucide-react";
import type { UpdateRequirementInput, Requirement, RiskLevel } from "@/types/domain";
import { VerdictTrail } from "@/components/requirements/VerdictTrail";

interface RequirementEditDialogProps {
  requirement: Requirement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: number, updates: UpdateRequirementInput) => Promise<void>;
  isSaving?: boolean;
  onReview?: (id: number, decision: "approved" | "rejected", note?: string) => Promise<void>;
  isReviewing?: boolean;
}

/**
 * Djuplänk till paragrafen på lagen.nu. SFS-nr ("2005:551") + lagrum
 * ("8 kap. 4 a \u00a7") ger https://lagen.nu/2005:551#K8P4a.
 * Returnerar null om SFS-nr saknas eller inte ser ut som ett SFS-nummer.
 */
function buildLagenNuUrl(sfs?: string, lagrum?: string): string | null {
  if (!sfs || !/^\d{4}:\d+\w*$/.test(sfs.trim())) return null;
  const base = `https://lagen.nu/${sfs.trim()}`;
  if (!lagrum) return base;
  const m = lagrum.match(/^(?:(\d+)\s*kap\.?\s*)?(\d+)\s*([a-z])?\s*\u00a7/i);
  if (!m) return base;
  const [, kap, par, bokstav] = m;
  const anchor = `${kap ? `K${kap}` : ""}P${par}${bokstav ? bokstav.toLowerCase() : ""}`;
  return `${base}#${anchor}`;
}

export const RequirementEditDialog = ({
  requirement,
  open,
  onOpenChange,
  onSave,
  isSaving = false,
  onReview,
  isReviewing = false,
}: RequirementEditDialogProps) => {
  const [titel, setTitel] = useState("");
  const [beskrivning, setBeskrivning] = useState("");
  const [subjekt, setSubjekt] = useState("");
  const [triggers, setTriggers] = useState("");
  const [undantag, setUndantag] = useState("");
  const [obligation, setObligation] = useState("");
  const [åtgärder, setÅtgärder] = useState("");
  const [risknivå, setRisknivå] = useState("");
  const [granskningsnot, setGranskningsnot] = useState("");

  useEffect(() => {
    setTitel(requirement.titel || "");
    setBeskrivning(requirement.beskrivning || "");
    setSubjekt(requirement.subjekt?.join(", ") || "");
    setTriggers(requirement.triggers?.join(", ") || "");
    setUndantag(requirement.undantag?.join(", ") || "");
    setObligation(requirement.obligation || "");
    setÅtgärder(requirement.åtgärder?.join(", ") || "");
    setRisknivå(requirement.risknivå || "");
    setGranskningsnot("");
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

        {(requirement.lagrum || requirement.legalSource) && (
          <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm space-y-1">
            {requirement.legalSource && (
              <div>
                <span className="font-semibold">Källa:</span>{" "}
                {requirement.legalSource.regelverkName || requirement.legalSource.title}
              </div>
            )}
            {requirement.sourceQuote && (
              <blockquote className="border-l-2 border-primary/40 pl-2 italic text-muted-foreground">
                &rdquo;{requirement.sourceQuote}&rdquo;
              </blockquote>
            )}
            {requirement.reviewerFlags && requirement.reviewerFlags.length > 0 && (
              <div className="text-destructive">
                <span className="font-semibold">Flaggor:</span>{" "}
                {requirement.reviewerFlags.join(", ")}
              </div>
            )}
            {requirement.lagrum && (
              <div className="flex items-center gap-2">
                <span>
                  <span className="font-semibold">Paragraf:</span> {requirement.lagrum}
                </span>
                {(() => {
                  const url = buildLagenNuUrl(
                    requirement.legalSource?.lagrum,
                    requirement.lagrum,
                  );
                  return url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
                    >
                      Öppna paragrafen (lagen.nu)
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        )}

        {/* Bedömningsspåret (block 5): nivå 1-badges + drill-down till
            granskarnas fullständiga bedömningar och råsvar. */}
        <div className="rounded-md border px-3 py-2">
          <VerdictTrail
            requirementId={requirement.id}
            provisionId={requirement.provisionId}
            chunkId={requirement.chunkId}
            machineReviewStatus={requirement.machineReviewStatus}
            deterministicFlags={requirement.reviewerFlags ?? []}
          />
        </div>

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

        {onReview && requirement.status !== "approved" && requirement.status !== "rejected" && (
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="granskningsnot">Granskningskommentar (valfri — loggas med beslutet)</Label>
            <Textarea
              id="granskningsnot"
              value={granskningsnot}
              onChange={(e) => setGranskningsnot(e.target.value)}
              placeholder="t.ex. citatet avviker från lagtexten; paragraf korrigerad"
              rows={2}
            />
          </div>
        )}

        <div className="flex justify-between gap-3 flex-wrap">
          <div className="flex gap-3">
            {onReview && requirement.status !== "approved" && requirement.status !== "rejected" && (
              <>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onReview(requirement.id, "approved", granskningsnot || undefined)}
                  disabled={isReviewing || isSaving}
                >
                  {isReviewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Godkänn
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => onReview(requirement.id, "rejected", granskningsnot || undefined)}
                  disabled={isReviewing || isSaving}
                >
                  {isReviewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Avvisa
                </Button>
              </>
            )}
            {(requirement.status === "approved" || requirement.status === "rejected") && (
              <span className="text-sm text-muted-foreground self-center">
                Beslut fattat: {requirement.status === "approved" ? "Godkänt" : "Avvisat"}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Avbryt
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Spara ändringar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
