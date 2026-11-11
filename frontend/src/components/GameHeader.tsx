import { Icon } from "./Icon";

export function GameHeader({
  title,
  eyebrow,
  subtitle,
  children,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="header-actions">{children}</div>
    </header>
  );
}

export function Notice({
  children,
  type = "error",
  onClose,
}: {
  children: React.ReactNode;
  type?: "error" | "success" | "info";
  onClose?: () => void;
}) {
  return (
    <div
      className={`notice notice-${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      <span>{children}</span>
      {onClose && (
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Cerrar mensaje"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
