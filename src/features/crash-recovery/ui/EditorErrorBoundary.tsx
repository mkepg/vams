import { Component, type ReactNode } from 'react';

const CHUNK_RELOAD_FLAG = 'vams-chunk-reload';
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Loading chunk|Failed to fetch/i;

/** True for errors thrown when a lazily loaded file cannot be fetched (for example after a deploy). */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_ERROR.test(message);
}

/** Reload once per tab session to fetch fresh files. Returns false when that was already tried. */
function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_FLAG)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

interface Props {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
}

interface State {
  error: Error | null;
  reloading: boolean;
}

/**
 * Catches editor render errors and shows `fallback` instead of a blank page.
 * Preact treats an error as handled only when the boundary's state changes, so both paths set state.
 */
export default class EditorErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reloading: false };

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error) && reloadOnce()) {
      this.setState({ reloading: true });
      return;
    }
    this.setState({ error: error instanceof Error ? error : new Error(String(error)), reloading: false });
  }

  render() {
    if (this.state.error) return this.props.fallback(this.state.error);
    if (this.state.reloading) return null;
    return this.props.children;
  }
}
