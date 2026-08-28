import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(path, "utf8");

describe("Admin authority migration source safety", () => {
  it("keeps reassignment in Admin Requests and Dashboard navigation-only", () => {
    const dashboard = read("src/pages/admin/Dashboard.jsx");
    const requestDialog = read("src/components/dialogs/RequestActionModal.jsx");

    expect(requestDialog).toContain("reassignRequest({");
    expect(dashboard).not.toContain("AssignTaskModal");
    expect(dashboard).not.toContain("reassignRequest");
    expect(dashboard).toContain("/admin/requests?requestId=");
    expect(requestDialog).not.toContain("status: scheduledDate ?");
    expect(requestDialog).toContain("/health-request/${taskData.id}/cancel-respond");
    expect(requestDialog).toContain("/ai-request/${taskData.id}/cancel-respond");
  });

  it("keeps Technician workflow handlers while gating Admin field actions", () => {
    const requestDialog = read("src/components/dialogs/RequestActionModal.jsx");
    const requestsPage = read("src/pages/technician/Requests.jsx");

    expect(requestDialog).toContain("handleClaimTask");
    expect(requestDialog).toContain('nextStatus === "in-progress"');
    expect(requestDialog).toContain("{isAdmin ? (");
    expect(requestsPage).toContain("if (!actionPolicy.canClaim) return;");
    expect(requestsPage).toContain(
      "if (!actionPolicy.canCancelOwnRequest || isUpdating) return;",
    );
  });

  it("removes rejected generic insemination edit and delete consumers", () => {
    const profile = read("src/pages/admin/LivestockProfile.jsx");
    const ledger = read("src/pages/technician/BreedingLedger.jsx");

    expect(profile).not.toContain("EditInseminationModal");
    expect(ledger).not.toContain("/insemination/${record.id}");
  });

  it("uses canonical Technician creation from the active Web registration form", () => {
    const technicians = read("src/pages/admin/Technicians.jsx");
    const invitationDialog = read(
      "src/components/dialogs/TechnicianInviteDialog.jsx",
    );

    expect(technicians).toContain("TechnicianInviteDialog");
    expect(invitationDialog).toContain("createTechnician(payload)");
    expect(invitationDialog).toContain("serviceCapabilities: capabilities");
    expect(invitationDialog).not.toContain("/user/create-invited-user");
  });
});
