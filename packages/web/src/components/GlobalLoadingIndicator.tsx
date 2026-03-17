import { useIsFetching } from '@tanstack/react-query';

/**
 * Shows a subtle loading indicator at the top of the page
 * when any queries are fetching in the background
 */
export function GlobalLoadingIndicator() {
  const isFetching = useIsFetching();

  if (!isFetching) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-0.5 bg-gray-200 overflow-hidden">
      <div className="h-full bg-gradient-to-r from-primary-400 via-primary-600 to-cyan-500 animate-progress" />
    </div>
  );
}

export default GlobalLoadingIndicator;
