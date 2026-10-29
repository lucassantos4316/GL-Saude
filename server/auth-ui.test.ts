import { describe, expect, it, vi } from "vitest";

vi.mock("../client/src/lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SupabaseLogin from "../client/src/components/SupabaseLogin";

describe("Supabase authentication UI", () => {
  it("renders email sign-in, Google sign-in, and registration entry point", () => {
    const html = renderToStaticMarkup(React.createElement(SupabaseLogin));
    expect(html).toContain("Acesse sua conta");
    expect(html).toContain("Continuar com Google");
    expect(html).toContain("Cadastre-se");
    expect(html).not.toContain("Entrar com conta institucional");
    expect(html).not.toContain("Modo demonstração");
  });
});
