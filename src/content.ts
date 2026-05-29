import { Activity, Clock3, Database, FileVideo, FolderOpen, Gauge, Image, LayoutDashboard, Palette, Settings, Sparkles, Wand2 } from "lucide-react";

export type PageId = "dashboard" | "studio" | "tasks" | "assets" | "settings";

export type NavItem = {
  id: PageId;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
};

export type Metric = {
  label: string;
  value: string;
  trend: string;
  icon: typeof Gauge;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", description: "Overview", icon: LayoutDashboard },
  { id: "studio", label: "Create Studio", description: "Script to video", icon: Wand2 },
  { id: "tasks", label: "Tasks", description: "Generation queue", icon: Activity },
  { id: "assets", label: "Assets", description: "Materials", icon: FolderOpen },
  { id: "settings", label: "Settings", description: "API and defaults", icon: Settings },
];

export const DASHBOARD_METRICS: Metric[] = [
  { label: "Draft concepts", value: "12", trend: "+4 this week", icon: Sparkles },
  { label: "Queued videos", value: "Live", trend: "Backed by FastAPI tasks", icon: Clock3 },
  { label: "Asset folders", value: "08", trend: "Local workspace", icon: Database },
  { label: "Render health", value: "Phase 2", trend: "Real API flow", icon: Gauge },
];

export const ASSET_GROUPS = [
  { title: "Source images", count: "24", icon: Image },
  { title: "Video clips", count: "16", icon: FileVideo },
  { title: "Voice presets", count: "06", icon: Palette },
];
