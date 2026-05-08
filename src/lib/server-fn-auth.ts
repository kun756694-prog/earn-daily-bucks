import { supabase } from "@/integrations/supabase/client";

// Patch global fetch once to attach the Supabase bearer token to
// every TanStack server-function request (/_serverFn/*).
let installed = false;
export function installServerFnAuth() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: any, init: RequestInit = {}) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input?.url ?? "");
    if (url.includes("/_serverFn/")) {
      const headers = new Headers(init.headers || (input?.headers as any));
      if (!headers.has("authorization")) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) headers.set("authorization", `Bearer ${token}`);
      }
      return orig(input, { ...init, headers });
    }
    return orig(input, init);
  };
}