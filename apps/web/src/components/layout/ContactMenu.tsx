import { Link, useLocation } from 'react-router-dom'
import { Users, UserPlus } from 'lucide-react'
import { cn } from '../../lib/utils'

export const ContactMenu = () => {
  const location = useLocation()

  const menuItems = [
    { icon: Users, label: 'Danh sách bạn bè', path: '/contacts' },
    { icon: Users, label: 'Danh sách nhóm và cộng đồng', path: '/contacts/groups' },
    { icon: UserPlus, label: 'Lời mời kết bạn', path: '/contacts/requests' },
  ]

  return (
    <nav className="flex-1 overflow-y-auto pt-2">
      {menuItems.map((item) => {
        const isActive = location.pathname === item.path
        return (
          <Link
            key={item.label}
            to={item.path}
            className={cn(
              "mx-2 mt-1 flex items-center gap-3 p-2 rounded-md transition-colors group",
              isActive ? "bg-[#e5efff] text-[#005AE0]" : "hover:bg-[#f3f5f6] text-gray-700"
            )}
          >
            <div className={cn(
              "w-10 h-10 flex items-center justify-center shrink-0",
            )}>
              <item.icon className={cn(
                "w-5 h-5",
                isActive ? "text-[#005AE0]" : "text-gray-600"
              )} />
            </div>
            <span className="text-sm">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
