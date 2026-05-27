import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircleMore, Contact } from "lucide-react";
import AppAvatar from "../common/AppAvatar";
import SideBarItem from "../common/sidebar/SideBarItem";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useEffect, useState } from "react";
import { userService } from "../../services/user.service";
import ProfileModal from "./ProfileModal";
import SettingDropdownSidebar from "../common/sidebar/SettingDropdown";
import { useSelector } from "react-redux";
import { useSocket } from "../../contexts/SocketContext";

interface NavItem {
  icon: any;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: MessageCircleMore, label: "Tin nhắn", path: "/" },
  { icon: Contact, label: "Danh bạ", path: "/contacts" },
];

export const SidebarPrimary = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>();
  const [open, setOpen] = useState<boolean>(false);
  const userId = useSelector((item: any) => item.auth.user?.userId);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await userService.getProfile(userId);
        if (data.success) {
          setUser(data.data);
        }
      } catch (err) {
        console.log(err);
      }
    };
    fetchUser();
  }, []);

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleUpdateProfile = (data: any) => {
      if (data.userId === userId) {
        setUser((prev: any) => ({
          ...prev,
          profile: {
            ...prev?.profile,
            ...data,
          },
        }));
      }
    };

    socket.on("update_profile", handleUpdateProfile);

    return () => {
      socket.off("update_profile", handleUpdateProfile);
    };
  }, [socket, userId]);

  return (
    <aside className="w-16 bg-[#005AE0] flex flex-col items-center py-4 shrink-0 z-20">
      {/* User Avatar */}
      <div className="relative mb-6">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative cursor-pointer">
              <AppAvatar
                onClick={() => setOpen(true)}
                src={user?.profile?.avatarUrl}
                name={user?.profile?.name || "User"}
                className="w-12 h-12 border border-white/10 hover:opacity-90 transition-opacity"
              />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#005AE0] rounded-full"></div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Hồ sơ cá nhân</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <ProfileModal
        setUser={setUser}
        user={user}
        open={open}
        onClose={() => setOpen(false)}
      />

      <nav className="flex-1 w-full flex flex-col items-center space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/" ||
              location.pathname.startsWith("/chat") ||
              location.pathname.startsWith("/conversation")
              : location.pathname.startsWith(item.path);

          return (
            <SideBarItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              isActive={isActive}
              onClick={() => navigate(item.path)}
            />
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center">
        <SettingDropdownSidebar onOpenProfile={() => setOpen(true)} />
      </div>
    </aside>
  );
};
