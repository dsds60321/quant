import { Icon, type IconName } from "@/components/ui/Icon";

export function PrimaryButton({
  label,
  icon = "play",
  onClick,
  disabled = false,
  type = "button",
}: {
  label: string;
  icon?: IconName;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="ui-button-primary gap-2 rounded-md shadow-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
