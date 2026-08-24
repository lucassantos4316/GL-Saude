import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Login } from "../client/src/pages/Home";

describe("GGL saude login UI", () => {
  it("renders the three profile options and the entry action", () => {
    const html = renderToStaticMarkup(React.createElement(Login, { onEnter: () => undefined }));
    expect(html).toContain("Perfil de acesso");
    expect(html).toContain("Entrar na GGL saude");
    expect(html).toContain("Modo demonstração");
  });
});
