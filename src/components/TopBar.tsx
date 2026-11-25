import { Menu } from 'lucide-react';
import type { WorkspaceView } from './Sidebar';

interface TopBarProps {
  activeView: WorkspaceView;
  onOpenMobileNav: () => void;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  primaryActionDisabled?: boolean;
}

const VIEW_TITLES: Record<WorkspaceView, string> = {
  inspect: 'Live Inspection',
  batch: 'Batch Queue',
  ledger: 'Audit Ledger',
  standards: 'QA Standards',
};

export function TopBar({
  activeView,
  onOpenMobileNav,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionDisabled,
}: TopBarProps) {
  return (
    <header className="h-15 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-400 whitespace-nowrap shrink-0">Workspace</span>
          <span className="text-slate-300" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-900 truncate">
            {VIEW_TITLES[activeView]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onPrimaryAction}
          disabled={primaryActionDisabled}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          {primaryActionLabel}
        </button>
      </div>
    </header>
  );
}
