import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserButton, useClerk } from '@clerk/clerk-react';
import { 
  Home, 
  Scroll, 
  Settings,
  Swords,
  LogOut
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { openUserProfile, signOut } = useClerk();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };
  
  const navItems = [
    { path: '/app', icon: Home, label: 'Dashboard' },
    { path: '/app/campaigns', icon: Scroll, label: 'Campaigns' },
  ];

  const isActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-dungeon-900/50 border-r border-dungeon-700/50 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-dungeon-700/50">
          <Link to="/app" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-mystic-600 flex items-center justify-center">
              <Swords className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold text-parchment-100">
                D&D Companion
              </h1>
              <p className="text-xs text-dungeon-400">Campaign Manager</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg
                  transition-all duration-200
                  ${active 
                    ? 'bg-mystic-600/20 text-mystic-300 border-l-2 border-mystic-500' 
                    : 'text-dungeon-300 hover:bg-dungeon-800/50 hover:text-parchment-200'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Quick Actions */}
        <div className="p-4 border-t border-dungeon-700/50">
          <Link
            to="/app/campaigns/new"
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Scroll className="w-4 h-4" />
            New Campaign
          </Link>
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-dungeon-700/50">
          <div className="flex items-center gap-3">
            <UserButton 
              appearance={{
                elements: {
                  avatarBox: 'w-10 h-10',
                }
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-parchment-200 truncate">
                Dungeon Master
              </p>
              <p className="text-xs text-dungeon-400">
                Manage Account
              </p>
            </div>
            <button 
              onClick={() => openUserProfile()}
              className="p-2 text-dungeon-400 hover:text-parchment-200 transition-colors"
              title="Account Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={handleSignOut}
              className="p-2 text-dungeon-400 hover:text-dragon-400 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="pattern-grid min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}

