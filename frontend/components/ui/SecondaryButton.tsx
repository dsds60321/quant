import { Icon, type IconName } from "@/components/ui/Icon";

export function SecondaryButton({
  label,
  icon = "refresh",
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
      className="ui-button-secondary gap-2 rounded-md bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon name={icon} className="h-3.5 w-3.5 text-[color:var(--fg-muted)]" />
      {label}
    </button>
  );
}
