import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { clearToken } from "@/lib/token";

export function useAuth() {
  const { data: user, isLoading } = useGetMe();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const logoutMutation = useLogout();

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        clearToken();
        queryClient.clear();
        setLocation("/");
      },
      onError: () => {
        clearToken();
        queryClient.clear();
        setLocation("/");
      },
    });
  };

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };
}
