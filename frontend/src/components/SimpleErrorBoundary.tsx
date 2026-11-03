import React from "react";

export class SimpleErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <div className="p-4 text-red-500">Erro: {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}
