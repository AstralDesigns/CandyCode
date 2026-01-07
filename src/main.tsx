import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './utils/tooltip';

// Error boundary for better error handling
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[React Error Boundary]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: '#0a0e27',
          color: '#e2e8f0',
          padding: '40px',
          fontFamily: 'system-ui',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ maxWidth: '600px' }}>
            <h1 style={{ color: '#fbbf24', marginBottom: '10px' }}>React Error</h1>
            <p style={{ color: '#94a3b8', marginBottom: '20px' }}>
              {this.state.error?.message || 'An error occurred'}
            </p>
            <pre style={{
              background: '#1e293b',
              padding: '15px',
              borderRadius: '5px',
              overflow: 'auto',
              fontSize: '12px'
            }}>
              {this.state.error?.stack}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Ensure root element exists
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[Main] Root element not found!');
  document.body.innerHTML = '<div style="padding: 40px; color: #fbbf24; font-family: system-ui;"><h1>Error: Root element not found</h1><p>The #root element is missing from the HTML.</p></div>';
} else {
  console.log('[Main] Initializing React app...');
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
  console.log('[Main] React app initialized');
}
