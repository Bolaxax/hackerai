"use client";

import { useEffect, useState } from "react";
import { isCloudSandboxDisabled } from "@/lib/sandbox/cloud-availability";

const INITIAL_EMPTY_CONNECTION_GRACE_MS = 750;

/**
 * Keeps the initial loading state stable when the first resolved connection
 * snapshot is briefly empty. Later disconnects are never delayed.
 */
export function useInitialConnectionPending({
  connected,
  connectionCount,
  preference,
}: {
  connected: boolean;
  connectionCount: number | undefined;
  preference: string;
}): boolean {
  const [hasObservedLoading] = useState(connectionCount === undefined);
  const [settledPreference, setSettledPreference] = useState<string | null>(
    null,
  );
  // Without Cloud, "e2b" waits for the first computer to be discovered.
  const cloudSelected = preference === "e2b" && !isCloudSandboxDisabled();

  useEffect(() => {
    if (cloudSelected) return;

    if (connected) {
      if (settledPreference === preference) return;
      const timeout = window.setTimeout(() => {
        setSettledPreference(preference);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    if (
      connectionCount === undefined ||
      connectionCount > 0 ||
      !hasObservedLoading ||
      settledPreference === preference
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSettledPreference(preference);
    }, INITIAL_EMPTY_CONNECTION_GRACE_MS);
    return () => window.clearTimeout(timeout);
  }, [
    cloudSelected,
    connected,
    connectionCount,
    hasObservedLoading,
    preference,
    settledPreference,
  ]);

  return (
    !cloudSelected &&
    !connected &&
    (connectionCount === undefined ||
      (connectionCount === 0 &&
        hasObservedLoading &&
        settledPreference !== preference))
  );
}
