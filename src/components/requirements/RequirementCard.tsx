import React, { memo } from "react";
import { Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Requirement } from "@/types/domain";

interface RequirementCardProps {
  requirement: Requirement;
  isAdmin: boolean;
  onEdit: (requirement: Requirement) => void;
  onDelete: (id: string) => void;
}

const RequirementCardComponent = ({
  requirement,
  isAdmin,
  onEdit,
  onDelete,
}: RequirementCardProps) => {
  const req = requirement;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">{req.titel}</CardTitle>
            <CardDescription className="mt-2 space-y-1">
              <div>
                <span className="font-semibold">Källa:</span>{" "}
                {req.legalSource?.regelverkName || req.legalSource?.title}
              </div>
              {req.legalSource?.lagrum && (
                <div>
                  <span className="font-semibold">Paragraf:</span>{" "}
                  {req.legalSource.lagrum}
                </div>
              )}
            </CardDescription>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => onEdit(req)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onDelete(req.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Beskrivning:</p>
            <p className="text-sm">{req.beskrivning || "-"}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {req.subjekt && req.subjekt.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Subjekt:</p>
                <p className="text-sm">{req.subjekt.join(", ")}</p>
              </div>
            )}

            {req.obligation && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Obligation:</p>
                <p className="text-sm">{req.obligation}</p>
              </div>
            )}

            {req.risknivå && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Risknivå:</p>
                <span
                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    req.risknivå === "hög" || req.risknivå === "kritisk"
                      ? "bg-destructive/10 text-destructive"
                      : req.risknivå === "medel"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
                      : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                  }`}
                >
                  {req.risknivå}
                </span>
              </div>
            )}
          </div>

          {req.triggers && req.triggers.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Trigger:</p>
              <p className="text-sm">{req.triggers.join(", ")}</p>
            </div>
          )}

          {req.åtgärder && req.åtgärder.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Åtgärder:</p>
              <p className="text-sm">{req.åtgärder.join(", ")}</p>
            </div>
          )}

          {req.undantag && req.undantag.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Undantag:</p>
              <p className="text-sm">{req.undantag.join(", ")}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Memoize to prevent unnecessary re-renders in large lists
export const RequirementCard = memo(RequirementCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.requirement.id === nextProps.requirement.id &&
    prevProps.isAdmin === nextProps.isAdmin &&
    prevProps.requirement.titel === nextProps.requirement.titel &&
    prevProps.requirement.beskrivning === nextProps.requirement.beskrivning
  );
});
