"use client";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "en-vivo", label: "En vivo", icon: "\uD83D\uDD34" },
  { id: "abiertos", label: "Torneos", icon: "\u26BD" },
  { id: "proximos", label: "Pr\u00F3ximos", icon: "\uD83D\uDCC5" },
  { id: "mis-lukas", label: "Mis Lukas", icon: "\uD83E\uDE99" },
  { id: "perfil", label: "Perfil", icon: "\uD83D\uDC64" },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-brand-border bg-brand-blue-dark/97 backdrop-blur-xl">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 transition-colors ${
            activeTab === tab.id
              ? "text-brand-gold"
              : "text-brand-muted hover:text-brand-text"
          }`}
        >
          <span className="text-lg leading-none">{tab.icon}</span>
          <span className="text-[9px] font-semibold uppercase tracking-wider">
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
