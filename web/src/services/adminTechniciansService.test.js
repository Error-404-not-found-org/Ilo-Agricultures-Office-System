import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("../lib/axios", () => ({
  default: { post: mocks.post },
}));

import {
  buildTechnicianInvitationPayload,
  createTechnician,
  OTON_MUNICIPALITY,
} from "./adminTechniciansService";

describe("Admin Technician creation service", () => {
  beforeEach(() => mocks.post.mockReset());

  it("builds the canonical Oton Field Area and capability payload", () => {
    const payload = buildTechnicianInvitationPayload({
      firstName: "  Ana ",
      lastName: " Reyes ",
      email: " ANA@EXAMPLE.COM ",
      phoneNumber: "09171234567",
      street: " Sitio Uno ",
      barangay: " Poblacion South ",
      serviceCapabilities: ["AI", "HEALTH", "AI", "UNKNOWN"],
    });

    expect(payload).toMatchObject({
      firstName: "Ana",
      lastName: "Reyes",
      email: "ana@example.com",
      phoneNumber: "09171234567",
      address: {
        street: "Sitio Uno",
        barangay: "Poblacion South",
        city: "Oton",
        province: "Iloilo",
      },
      serviceMunicipalities: [OTON_MUNICIPALITY],
      serviceCapabilities: ["AI", "HEALTH"],
    });
    expect(payload).not.toHaveProperty("acceptsNewRequests");
    expect(payload).not.toHaveProperty("availabilityStatus");
  });

  it("creates a Technician through the canonical Admin endpoint", async () => {
    const payload = { firstName: "Ana", lastName: "Reyes" };
    mocks.post.mockResolvedValue({ data: { technician: { _id: "tech-1" } } });

    await createTechnician(payload);

    expect(mocks.post).toHaveBeenCalledWith("/admin/technicians", payload);
  });
});
