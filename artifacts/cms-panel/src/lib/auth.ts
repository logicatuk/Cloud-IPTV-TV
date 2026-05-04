export const getAuthToken = () => localStorage.getItem("maxplayer_token");
export const setAuthToken = (token: string) => localStorage.setItem("maxplayer_token", token);
export const removeAuthToken = () => localStorage.removeItem("maxplayer_token");

export const getAuthUser = () => {
  const user = localStorage.getItem("maxplayer_user");
  if (user) {
    try {
      return JSON.parse(user);
    } catch (e) {
      return null;
    }
  }
  return null;
};
export const setAuthUser = (user: any) => localStorage.setItem("maxplayer_user", JSON.stringify(user));
export const removeAuthUser = () => localStorage.removeItem("maxplayer_user");

export const clearAuth = () => {
  removeAuthToken();
  removeAuthUser();
};
