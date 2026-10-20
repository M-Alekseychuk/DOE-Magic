import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onResetTo2D?: () => void;
  resetKey?: any;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class PlotlyErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'WebGL rendering error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('Plotly 3D WebGL rendering issue caught by error boundary:', error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center h-full w-full bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
            WebGL 3D Accelerated Surface Unavailable
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mb-3">
            Your browser or device display driver encountered an issue initializing the 3D WebGL mesh. Switch to the 2D Contour Plot for full response surface contours.
          </p>
          {this.props.onResetTo2D && (
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                this.props.onResetTo2D?.();
              }}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded text-[11px] font-semibold transition-colors shadow-xs"
            >
              Switch to 2D Contour Plot
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
