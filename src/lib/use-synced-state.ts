"use client";

import { useState } from "react";

/**
 * Local state that starts from a server value and follows it when it
 * changes on the server (e.g. after "בטל" or the other partner's edit),
 * while still letting the user edit it locally in between.
 */
export function useSyncedState<T>(serverValue: T) {
  const [state, setState] = useState(serverValue);
  const [seen, setSeen] = useState(serverValue);
  if (!Object.is(seen, serverValue)) {
    setSeen(serverValue);
    setState(serverValue);
  }
  return [state, setState] as const;
}
