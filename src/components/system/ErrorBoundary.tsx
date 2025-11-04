import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: any };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error } as State;
  }

  componentDidCatch(error: any, info: any) {
    console.error("[ErrorBoundary]", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-md text-center space-y-3">
            <div className="text-2xl font-semibold">No se pudo cargar la aplicación</div>
            <p className="text-sm text-muted-foreground">
              Ocurrió un error inesperado. Si el servicio está temporalmente no disponible, intenta recargar.
            </p>
            <button onClick={this.handleReload} className="px-4 py-2 rounded bg-primary text-primary-foreground">
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}