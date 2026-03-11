export interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  target: string;
  placement: "top" | "bottom" | "left" | "right";
  spotlightPadding?: number;
  page?: string;
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: "welcome",
    title: "Welcome to Young Owls Screenplay Studio!",
    description:
      "Your AI-powered workspace for screenwriting. Let us show you around — this will only take a minute.",
    target: "body",
    placement: "bottom",
  },
  {
    id: "new-project",
    title: "Create Your First Project",
    description:
      "Start by creating a new project. You can upload an existing screenplay or start from scratch.",
    target: '[data-tour="new-project"]',
    placement: "bottom",
  },
  {
    id: "project-list",
    title: "Your Projects",
    description:
      "All your screenplays appear here as cards. Click any project to open it and access all tools.",
    target: '[data-tour="project-list"]',
    placement: "top",
  },
  {
    id: "sidebar-nav",
    title: "Navigation Sidebar",
    description:
      "Once inside a project, use the sidebar to access different tools — from scene editing to AI generation.",
    target: '[data-tour="sidebar"]',
    placement: "right",
  },
  {
    id: "ai-tools",
    title: "AI-Powered Tools",
    description:
      "Generate images, videos, audio, analyze scripts, polish dialogue — all powered by AI. Configure your API keys in Settings.",
    target: '[data-tour="ai-tools"]',
    placement: "right",
  },
  {
    id: "settings",
    title: "Settings & API Keys",
    description:
      "Configure your API keys for Claude, fal.ai, and ElevenLabs to unlock all AI features.",
    target: '[data-tour="settings"]',
    placement: "top",
  },
  {
    id: "theme-toggle",
    title: "Customize Your Experience",
    description:
      "Switch between dark and light mode, or visit Settings to fully customize the theme, fonts, and appearance.",
    target: '[data-tour="theme-toggle"]',
    placement: "left",
  },
  {
    id: "complete",
    title: "You're All Set!",
    description:
      "That's the basics! Create your first project to get started. You can replay this tour anytime from Settings.",
    target: "body",
    placement: "bottom",
  },
];
