import type { ReactNode } from 'react';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function ScreenHeader({
  title,
  subtitle,
  action,
  children,
  className = '',
}: ScreenHeaderProps) {
  return (
    <header className={`screen-header ${className}`.trim()}>
      <div className="screen-header__top">
        <div className="screen-header__text">
          <h1 className="screen-header__title">{title}</h1>
          {subtitle ? <p className="screen-header__subtitle">{subtitle}</p> : null}
        </div>
        {action ? <div className="screen-header__action">{action}</div> : null}
      </div>
      {children ? <div className="screen-header__extra">{children}</div> : null}
    </header>
  );
}

interface ScreenHeaderIconButtonProps {
  onClick: () => void;
  ariaLabel: string;
  children: ReactNode;
}

export function ScreenHeaderIconButton({
  onClick,
  ariaLabel,
  children,
}: ScreenHeaderIconButtonProps) {
  return (
    <button
      type="button"
      className="screen-header__icon-btn button-finance"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
