import { Icon } from "./Icon";
import {PopupNotice} from './PopupNotice';

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
  if(type==='error')return <PopupNotice onClose={onClose}>{children}</PopupNotice>;
  return (
    <div
      className={`notice notice-${type}`}
      role="status"
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
