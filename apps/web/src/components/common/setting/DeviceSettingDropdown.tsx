import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ellipsis, LogOut, Ban } from "lucide-react";

type DeviceSettingDropdown = {
  onLougout?: () => void;
  onBlock?: () => void;
};

export default function DeviceSettingDropdown({
  onLougout,
  onBlock,
}: DeviceSettingDropdown) {
  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Ellipsis color="gray" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-40 bg-white" align="start">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onLougout}>
              <LogOut />
              Đăng xuất
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={onBlock}>
              <Ban /> Chặn{" "}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
