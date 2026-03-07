import { Component } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProjectList from './components/ProjectList';
import ProjectView from './components/ProjectView';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('React error boundary caught:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#ff4a4a', background: '#1e1e1e', height: '100vh', fontFamily: 'monospace' }}>
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#e0e0e0', marginTop: 16 }}>
            {this.state.error.toString()}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/project/:projectId" element={<ProjectView />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
