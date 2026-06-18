import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  crashed: boolean;
}

/**
 * ChunkReloadGuard — atrapa errores de chunks stale dentro de Suspense.
 * En lugar de mostrar el ErrorBoundary completo, fuerza un reload suave
 * y muestra un mini estado de "Actualizando..." mientras tanto.
 */
export default class ChunkReloadGuard extends Component<Props, State> {
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const msg = String(error?.message || '');
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module')
    ) {
      return { crashed: true };
    }
    // No es un error de chunk — lo dejamos propagar al ErrorBoundary padre
    throw error;
  }

  componentDidCatch(_error: Error): void {
    // Solo llegamos aquí si getDerivedStateFromError no re-throw — es chunk error.
    // El handler global en main.tsx ya está forzando el reload.
    // Este timer es un fallback por si el global tarda.
    if (this.reloadTimer) return;
    this.reloadTimer = setTimeout(() => {
      window.location.replace(window.location.href);
    }, 1200);
  }

  componentWillUnmount(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
  }

  render(): ReactNode {
    if (this.state.crashed) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 font-medium">Actualizando...</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}