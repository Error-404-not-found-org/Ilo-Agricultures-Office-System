import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appLayout = readFileSync("src/components/layout/AppLayout.jsx", "utf8");
const sidebar = readFileSync("src/components/layout/Sidebar.jsx", "utf8");
const styles = readFileSync("src/index.css", "utf8");

describe("shared Admin layout scroll ownership", () => {
  it("uses the dynamic viewport and one main content scroller", () => {
    expect(appLayout).toContain("h-dvh min-h-0");
    expect(appLayout).toContain("admin-main-scroll");
    expect(appLayout).toContain("min-h-0 min-w-0 flex-1 overflow-y-auto");
    expect(appLayout.match(/admin-main-scroll/g)).toHaveLength(1);
  });

  it("normalizes legacy routed page scroll roots without affecting nested tables", () => {
    expect(styles).toContain(".admin-main-scroll > *");
    expect(styles).toContain("height: auto !important");
    expect(styles).toContain("overflow-y: visible !important");
    expect(styles).not.toContain(".admin-main-scroll * {");
  });

  it("keeps the sidebar inside the shared dynamic viewport shell", () => {
    expect(sidebar).toContain("admin-sidebar");
    expect(styles).toContain(".drawer-side > .admin-sidebar");
    expect(styles).toContain("height: 100vh");
    expect(styles).toContain("height: 100dvh");
  });

  it("keeps only navigation scrollable while protecting the account footer", () => {
    expect(sidebar).toContain("custom-scrollbar flex min-h-0 flex-1");
    expect(sidebar).toContain("overflow-y-auto overscroll-contain");
    expect(sidebar).toContain("admin-sidebar-footer shrink-0");
    expect(styles).toContain(
      "padding-bottom: calc(1rem + env(safe-area-inset-bottom))",
    );
  });

  it("keeps final content above mobile browser chrome", () => {
    expect(styles).toContain("@media (max-width: 47.999rem)");
    expect(styles).toContain(
      "padding-bottom: calc(3rem + env(safe-area-inset-bottom))",
    );
    expect(styles).toContain(
      "scroll-padding-bottom: calc(3rem + env(safe-area-inset-bottom))",
    );
  });
});
