import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getAuthToken, clearAuth } from "./auth";

// Set token getter for orval custom fetch
setAuthTokenGetter(() => {
  return getAuthToken();
});

// We could handle 401 intercepts here, but customFetch throws ApiError,
// we can catch it globally in QueryClient
