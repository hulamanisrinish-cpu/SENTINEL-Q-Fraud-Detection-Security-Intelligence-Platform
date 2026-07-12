import { AlertTriangle, Lock, Settings, LayoutDashboard } from 'lucide-react'

type Tab = 'alerts' | 'detail' | 'crypto' | 'config' | 'dashboard'

interface BottomNavProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: 'dashboard' as Tab, label: 'DASHBOARD', icon: LayoutDashboard },
    { id: 'alerts' as Tab, label: 'ALERTS', icon: AlertTriangle },
    { id: 'crypto' as Tab, label: 'CRYPTO', icon: Lock },
    { id: 'config' as Tab, label: 'CONFIG', icon: Settings },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-[#27272A] px-6 py-4 z-50">
      <div className="flex justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-2 px-4 py-3 rounded-2xl transition-all relative overflow-hidden ${
                isActive 
                  ? 'bg-[#E5E5E5] text-black' 
                  : 'text-[#A1A1AA] hover:bg-[#27272A]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-mono font-semibold">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
