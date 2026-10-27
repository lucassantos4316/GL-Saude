import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Login } from "../client/src/pages/Home";

describe("GGL saude login UI", () => {
  it("renders the entry action without a profile selector", () => {
    const html = renderToStaticMarkup(React.createElement(Login, { onEnter: () => undefined }));
    expect(html).not.toContain("Perfil de acesso");
    expect(html).toContain(">Entrar <");
    expect(html).toContain("Modo demonstração");
  });
});
