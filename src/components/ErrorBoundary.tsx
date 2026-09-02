import { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, AlertTriangle, Sparkles } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Vanishing Pines Uncaught Runtime Exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[999] bg-stone-950 flex flex-col items-center justify-center p-6 text-center text-stone-100 select-none overflow-y-auto">
          {/* Western Ornaments */}
          <div className="absolute inset-4 border border-amber-800/40 rounded-3xl pointer-events-none" />
          <div className="absolute inset-6 border border-amber-600/20 rounded-2xl pointer-events-none" />

          <div className="relative mb-4 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-stone-900 border-2 border-red-500/70 shadow-2xl flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-amber-400 stroke-[2]" />
            </div>
          </div>

          <h1 className="text-2xl font-serif font-black text-amber-200 mb-2 tracking-wide">
            Vanishing Pines • Frontier Recovery
          </h1>
          <p className="text-sm text-stone-300 max-w-sm mb-6 leading-relaxed">
            حدث تنبيه أثناء تشغيل محرك اللعبة في هذا المتصفح. يمكنك إعادة تشغيل اللعبة بضغطة زر واحدة.
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs z-10">
            <button
              onClick={this.handleReload}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 active:scale-95 text-stone-950 font-bold font-mono text-sm flex items-center justify-center gap-2 shadow-xl border border-amber-300 transition"
            >
              <RotateCcw className="w-4 h-4 text-stone-950" />
              <span>إعادة تشغيل اللعبة • Reload Game</span>
            </button>
          </div>

          {this.state.error && (
            <div className="mt-6 max-w-md w-full bg-stone-900/90 border border-stone-800 rounded-xl p-3 text-left font-mono text-[11px] text-stone-400 overflow-x-auto">
              <span className="text-amber-400 font-bold">Error:</span> {this.state.error.toString()}
            </div>
          )}

          <div className="mt-4 text-[10px] text-stone-300 font-mono flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Vanishing Pines Simulation Engine</span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
