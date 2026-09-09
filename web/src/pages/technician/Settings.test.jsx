import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Settings from "./Settings";
function Destination() { const location = useLocation(); return <h1>{location.pathname}</h1>; }
describe("Technician Settings compatibility", () => {
  it("redirects bookmarked Settings URLs to Profile", async () => {
    render(<MemoryRouter initialEntries={["/technician/settings?tab=security"]}><Routes><Route path="/technician/settings" element={<Settings />} /><Route path="/technician/profile" element={<Destination />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "/technician/profile" })).toBeVisible();
  });
});
