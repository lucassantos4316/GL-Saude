import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Login } from "../client/src/pages/Home";

describe("GGL saude login UI", () => {
  it("renders Google sign-in and registration without demo or institutional-login copy", () => {
    const html = renderToStaticMarkup(React.createElement(Login, { onEnter: () => undefined }));
    expect(html).not.toContain("Perfil de acesso");
    expect(html).toContain(">Entrar <");
    expect(html).toContain("Continuar com Google");
    expect(html).toContain("Cadastre-se");
    expect(html).not.toContain("Entrar com conta institucional");
    expect(html).not.toContain("Modo demonstração");
  });
});
