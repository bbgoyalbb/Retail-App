import { Component } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from '@phosphor-icons/react';

/**
 * Route-level Error Boundary
 * Catches errors at the route level and provides recovery options
 */
export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('Route Error Boundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle size={40} weight="duotone" className="text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-foreground">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">
                {this.state.error?.message || 'An unexpected error occurred while loading this page.'}
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="text-left bg-muted/50 rounded-lg p-4">
                <summary className="text-xs font-semibold text-muted-foreground cursor-pointer mb-2">
                  Error Details (Development Only)
                </summary>
                <pre className="text-xs text-destructive overflow-auto max-h-40">
                  {this.state.error?.toString()}
                  {'\n\n'}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={this.handleReset}
                variant="default"
                className="gap-2"
              >
                <RefreshCw size={18} weight="bold" />
                Try Again
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="gap-2"
              >
                <Home size={18} weight="bold" />
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
