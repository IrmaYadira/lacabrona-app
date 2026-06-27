// Error Boundary para atrapar errores de renderizado
import { Component, type ReactNode, type ErrorInfo } from "react";
import { addDebugLog } from "@/hooks/useDebugLogs";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  showDetails: boolean;
  copied: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, showDetails: false, copied: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: false, copied: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    addDebugLog(
      "error",
      `ErrorBoundary: ${error.message}`,
      `Componente: ${errorInfo.componentStack?.split("\n")[1]?.trim() || "Unknown"}`,
      `${error.stack || ""}\n\nComponent Stack:\n${errorInfo.componentStack || ""}`
    );
  }

  isChunkError = () => {
    const msg = this.state.error?.message || "";
    return (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("error loading dynamically imported module")
    );
  };

  handleCopy = () => {
    const { error, errorInfo } = this.state;
    const text = `Error: ${error?.message || "N/A"}\n\nStack:\n${error?.stack || "N/A"}\n\nComponent Stack:\n${errorInfo?.componentStack || "N/A"}`;
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const isChunk = this.isChunkError();
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="w-full max-w-lg">
            {/* Icono */}
            <div className="text-center mb-6">
              <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${isChunk ? "bg-amber-100" : "bg-red-100"}`}>
                <i className={`ri-${isChunk ? "refresh-line" : "error-warning-line"} text-3xl ${isChunk ? "text-amber-500" : "text-red-500"}`} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {isChunk ? "Actualización disponible" : "Algo salió mal"}
              </h2>
              <p className="text-sm text-gray-500">
                {isChunk
                  ? "La app se actualizó. Recarga la página para cargar la versión más reciente."
                  : "Ocurrió un error inesperado. Puedes recargar la página o volver al inicio."}
              </p>
            </div>

            {/* Error card */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${isChunk ? "text-amber-600" : "text-red-600"}`}>
                    {isChunk ? "Actualización" : "Error"}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date().toLocaleString()}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800 break-words">
                  {this.state.error?.message || "Error desconocido"}
                </p>

                {/* Componente */}
                {this.state.errorInfo?.componentStack && (
                  <div className="mt-2 text-xs text-gray-500">
                    <span className="font-medium">Componente: </span>
                    {this.state.errorInfo.componentStack.split("\n")[1]?.trim() || "N/A"}
                  </div>
                )}
              </div>

              {/* Detalles expandibles */}
              <div className="border-t border-gray-100">
                <button
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <span>Ver detalles técnicos</span>
                  <i className={`ri-arrow-down-s-line transition-transform ${this.state.showDetails ? "rotate-180" : ""}`} />
                </button>
                {this.state.showDetails && (
                  <div className="px-4 pb-4">
                    <div className="bg-gray-50 rounded-lg p-3 overflow-auto max-h-[300px]">
                      <pre className="text-[11px] text-gray-700 whitespace-pre-wrap break-words">
                        <strong>Stack Trace:</strong>
                        {"\n"}
                        {this.state.error?.stack || "N/A"}
                        {"\n\n"}
                        <strong>Component Stack:</strong>
                        {"\n"}
                        {this.state.errorInfo?.componentStack || "N/A"}
                      </pre>
                    </div>
                    <button
                      onClick={this.handleCopy}
                      className="mt-2 flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 cursor-pointer transition-colors"
                    >
                      <i className={`${this.state.copied ? "ri-check-line text-emerald-500" : "ri-file-copy-line"}`} />
                      {this.state.copied ? "Copiado al portapapeles" : "Copiar error completo"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
              >
                <i className="ri-refresh-line" />
                {isChunk ? "Recargar y actualizar" : "Recargar página"}
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
              >
                <i className="ri-home-line" />
                Volver al inicio
              </button>
            </div>

            {/* Hint */}
            <p className="text-center text-[11px] text-gray-400 mt-4">
              Presiona <span className="font-medium">Ctrl + Shift + D</span> para abrir el Debug Panel
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}