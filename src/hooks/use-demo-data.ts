import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { logError, getUserFriendlyMessage } from "@/lib/error";
import {
  DEMO_WORKSPACE_NAME,
  DEMO_LEGAL_SOURCES,
  DEMO_REQUIREMENTS,
} from "@/lib/demo-data";

export function useDemoData() {
  const { user } = useAuth();
  const { createWorkspace, setActiveWorkspace, refreshWorkspaces } = useWorkspace();
  const [isLoading, setIsLoading] = useState(false);

  const loadDemoData = useCallback(async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Fel",
        description: "Du måste vara inloggad för att ladda demo-data.",
      });
      return false;
    }

    setIsLoading(true);

    try {
      // 1. Create demo workspace
      const workspace = await createWorkspace(DEMO_WORKSPACE_NAME);

      // 2. Insert demo legal sources
      const sourceInserts = DEMO_LEGAL_SOURCES.map((source) => ({
        title: source.title,
        content: source.content,
        regelverk_name: source.regelverkName,
        lagrum: source.lagrum,
        typ: source.typ,
        referens: source.referens,
        workspace_id: workspace.id,
      }));

      const { data: insertedSources, error: sourcesError } = await supabase
        .from("legal_source")
        .insert(sourceInserts)
        .select("id");

      if (sourcesError) throw sourcesError;

      // 3. Insert demo requirements linked to sources
      if (insertedSources && insertedSources.length > 0) {
        const requirementInserts = DEMO_REQUIREMENTS.map((req) => ({
          title: req.title,
          titel: req.titel,
          beskrivning: req.beskrivning,
          obligation: req.obligation,
          risknivå: req.risknivå,
          subjekt: req.subjekt,
          trigger: req.trigger,
          åtgärder: req.åtgärder,
          undantag: req.undantag,
          legal_source_id: insertedSources[req.sourceIndex]?.id || insertedSources[0].id,
          workspace_id: workspace.id,
          created_by: "demo",
        }));

        const { error: reqError } = await supabase
          .from("requirement")
          .insert(requirementInserts);

        if (reqError) throw reqError;
      }

      // 4. Set as active workspace
      await refreshWorkspaces();
      setActiveWorkspace(workspace);

      toast({
        title: "Demo-data laddad!",
        description: `Workspace "${DEMO_WORKSPACE_NAME}" har skapats med ${DEMO_LEGAL_SOURCES.length} källor och ${DEMO_REQUIREMENTS.length} krav.`,
      });

      return true;
    } catch (error) {
      logError(error, { context: "loadDemoData", userId: user.id });
      toast({
        variant: "destructive",
        title: "Kunde inte ladda demo-data",
        description: getUserFriendlyMessage(error),
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, createWorkspace, setActiveWorkspace, refreshWorkspaces]);

  return {
    loadDemoData,
    isLoading,
  };
}
