import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Shows what went wrong instead of a blank page when a screen crashes, with a way back.
 * The message and the first lines of the stack help diagnose device-specific bugs.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; where: string }> {
  state = { error: null as Error | null, where: "" };

  static getDerivedStateFromError(error: Error) {
    return { error, where: "" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[MuMu] screen crashed:", error, info.componentStack);
    this.setState({ where: (info.componentStack ?? "").trim().split("\n").slice(0, 4).join("\n") });
  }

  render() {
    const { error, where } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6 text-center text-ink">
        <img src="/favicon.svg" alt="" className="size-12 rounded-2xl" />
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <pre className="max-h-48 w-full max-w-md overflow-auto whitespace-pre-wrap rounded-2xl bg-surface-2 p-3 text-left text-xs text-muted">
          {error.message}
          {"\n"}
          {(error.stack ?? "").split("\n").slice(1, 4).join("\n")}
          {where && `\n\n${where}`}
        </pre>
        <div className="flex gap-2">
          <button onClick={() => location.reload()} className="h-11 rounded-full bg-brand px-5 font-semibold text-white">
            Reload
          </button>
          <button onClick={() => location.assign("/chats")} className="h-11 rounded-full bg-surface-2 px-5 font-semibold">
            Go to chats
          </button>
        </div>
      </div>
    );
  }
}
