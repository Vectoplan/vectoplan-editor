import type { EditorWorkspaceMode } from "../modes/editor_workspace_mode";

export function workspaceInventoryKey(mode: EditorWorkspaceMode): string {
  return mode === "planning" ? "planning" : "default";
}

export function workspaceInventoryUrl(url: string, mode: EditorWorkspaceMode, baseUrl: string): string {
  const target = new URL(url, baseUrl);
  target.searchParams.set("inventory_key", workspaceInventoryKey(mode));
  target.searchParams.set("workspace_mode", mode);
  return target.href;
}
