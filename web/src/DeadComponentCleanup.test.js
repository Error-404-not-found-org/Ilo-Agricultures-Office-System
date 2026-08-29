import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const removedFiles = [
  "src/pages/admin/Technicians.jsx",
  "src/pages/admin/TechniciansPhase3B.test.jsx",
  "src/pages/admin/PregnancyTracker.jsx",
  "src/pages/technician/RequestDetails.jsx",
  "src/components/layout/ProtectedFarmerRoute.jsx",
  "src/components/ui/Sidebar.jsx",
  "src/components/ui/LoadingView.jsx",
  "src/components/dialogs/AnimalHistoryDrawer.jsx",
  "src/components/dialogs/AnimalHistoryModal.jsx",
  "src/components/dialogs/BreedingVerificationModal.jsx",
  "src/components/dialogs/ConfirmDeleteModal.jsx",
  "src/components/dialogs/DailyReportModal.jsx",
  "src/components/dialogs/EditHealthModal.jsx",
  "src/components/dialogs/EditTechnicianModal.jsx",
  "src/components/dialogs/FarmerObservationModal.jsx",
  "src/components/dialogs/HealthDetailsModal.jsx",
  "src/components/dialogs/MissionDetailsModal.jsx",
  "src/components/dialogs/RescheduleCancelModal.jsx",
  "src/components/dialogs/AddTechnicianModal.jsx",
  "src/components/dialogs/EditInseminationModal.jsx",
  "src/components/ui/AchievementCard.jsx",
  "src/components/ui/Button.jsx",
  "src/components/ui/InsightCard.jsx",
  "src/components/ui/NotificationBell.jsx",
  "src/components/ui/Table.jsx",
];

describe("dead component cleanup", () => {
  it.each(removedFiles)("keeps removed file absent: %s", (path) => {
    expect(existsSync(path)).toBe(false);
  });

  it("keeps active route replacements and the canonical sidebar wired", () => {
    const app = readFileSync("src/App.jsx", "utf8");
    const appLayout = readFileSync("src/components/layout/AppLayout.jsx", "utf8");

    expect(app).toContain('import("./pages/admin/AdminPregnancyOversight")');
    expect(app).toContain("LegacyTechnicianRequestDetailsRedirect");
    expect(app).not.toContain('import("./pages/admin/PregnancyTracker")');
    expect(app).not.toContain('import("./pages/technician/RequestDetails")');
    expect(appLayout).toContain('import Sidebar from "./Sidebar"');
    expect(existsSync("src/components/layout/Sidebar.jsx")).toBe(true);
  });

  it("keeps canonical Admin authority helpers in active use", () => {
    const users = readFileSync("src/pages/admin/Users.jsx", "utf8");
    const invitationDialog = readFileSync(
      "src/components/dialogs/TechnicianInviteDialog.jsx",
      "utf8",
    );
    const technicianService = readFileSync(
      "src/services/adminTechniciansService.js",
      "utf8",
    );
    const requestService = readFileSync(
      "src/services/adminRequestsService.js",
      "utf8",
    );

    expect(users).toContain("TechnicianInviteDialog");
    expect(invitationDialog).toContain("createTechnician");
    expect(technicianService).toContain('"/admin/technicians"');
    expect(requestService).toContain(
      "`/admin/requests/${requestType}/${encodeURIComponent(requestId)}/reassign`",
    );
  });

  it("keeps generic Insemination edit and delete wiring out of active profiles", () => {
    const livestockProfile = readFileSync(
      "src/pages/admin/LivestockProfile.jsx",
      "utf8",
    );
    const breedingLedger = readFileSync(
      "src/pages/technician/BreedingLedger.jsx",
      "utf8",
    );

    expect(livestockProfile).not.toContain("EditInseminationModal");
    expect(breedingLedger).not.toContain("/insemination/${record.id}");
  });
});
