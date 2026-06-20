// Catches render errors from the new desktop HomeDashboard so a
// problem inside it (e.g. unexpected data shape, missing field) does
// NOT blank the entire dashboard. On error we render nothing for the
// desktop layer — the mobile/tablet layout below still works as a
// safety net.

import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State { return { hasError: true }; }

  componentDidCatch(error: unknown) {
    // Log once so we can spot it in the console but don't keep
    // throwing — the mobile layout below renders the same data.
    console.error('[HomeDashboard] desktop layer crashed:', error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
