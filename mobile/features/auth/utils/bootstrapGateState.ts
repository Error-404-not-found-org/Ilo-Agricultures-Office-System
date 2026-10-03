interface BootstrapGateStateInput {
  isSignedIn: boolean;
  dbUserId?: string;
  establishedOwnerId?: string;
  isBootstrapLoading: boolean;
  hasBootstrapError: boolean;
  isTransientBootstrapError?: boolean;
  isSuspended: boolean;
}

export type BootstrapGateState =
  | "suspended"
  | "initial-loading"
  | "error"
  | "authenticated"
  | "content";

export const getBootstrapGateState = ({
  isSignedIn,
  dbUserId,
  establishedOwnerId,
  hasBootstrapError,
  isTransientBootstrapError,
  isSuspended,
}: BootstrapGateStateInput): BootstrapGateState => {
  if (isSuspended) return "suspended";
  if (!isSignedIn) return "content";
  const hasEstablishedUser = Boolean(dbUserId && establishedOwnerId === dbUserId);
  if (hasBootstrapError && !(hasEstablishedUser && isTransientBootstrapError)) return "error";
  if (!hasEstablishedUser) return "initial-loading";
  // Query fetching state is not a navigation prerequisite once this owner is established.
  return "authenticated";
};
