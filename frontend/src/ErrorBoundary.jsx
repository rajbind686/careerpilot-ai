import React from 'react';

/**
 * Global React Error Boundary for CareerPilot AI
 * -----------------------------------------------
 * Prevents unhandled render errors from unmounting the whole application
 * and showing a blank white screen. Displays a helpful recovery view with
 * error details and reload action.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CareerPilot AI caught error in component tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          padding: '24px',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '640px',
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #fecaca',
            borderLeft: '4px solid #ef4444',
            padding: '28px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#991b1b', marginBottom: '8px' }}>
              Application Render Error
            </h2>
            <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.5, marginBottom: '16px' }}>
              CareerPilot AI encountered an unexpected error while rendering this view.
            </p>
            <div style={{
              background: '#fef2f2',
              color: '#991b1b',
              padding: '12px 14px',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '12.5px',
              marginBottom: '18px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {this.state.error ? this.state.error.toString() : 'Unknown error'}
            </div>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 18px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
