import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { Workspace } from "@/types/domain";

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  setActiveWorkspace: (workspace: Workspace) => void;
  createWorkspace: (name: string) => Promise<Workspace>;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
};

const ACTIVE_WORKSPACE_KEY = "lsg_active_workspace_id";

export const WorkspaceProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("workspace")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const mapped: Workspace[] = (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        ownerId: row.owner_id,
        createdAt: new Date(row.created_at),
      }));

      setWorkspaces(mapped);

      // Set default active workspace if none selected
      if (mapped.length > 0 && !activeWorkspaceId) {
        const defaultId = mapped[0].id;
        setActiveWorkspaceId(defaultId);
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, defaultId);
      }
    } catch (error) {
      console.error("Error fetching workspaces:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, activeWorkspaceId]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0] || null;
  }, [workspaces, activeWorkspaceId]);

  const setActiveWorkspace = useCallback((workspace: Workspace) => {
    setActiveWorkspaceId(workspace.id);
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace.id);
  }, []);

  const createWorkspace = useCallback(async (name: string): Promise<Workspace> => {
    if (!user) throw new Error("Must be logged in to create workspace");

    const { data, error } = await supabase
      .from("workspace")
      .insert([{ name, owner_id: user.id }])
      .select()
      .single();

    if (error) throw error;

    // Add owner as member
    await supabase
      .from("workspace_member")
      .insert([{ workspace_id: data.id, user_id: user.id, role: "owner" }]);

    const newWorkspace: Workspace = {
      id: data.id,
      name: data.name,
      ownerId: data.owner_id,
      createdAt: new Date(data.created_at),
    };

    setWorkspaces((prev) => [...prev, newWorkspace]);
    return newWorkspace;
  }, [user]);

  const refreshWorkspaces = useCallback(async () => {
    await fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        isLoading,
        setActiveWorkspace,
        createWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};
