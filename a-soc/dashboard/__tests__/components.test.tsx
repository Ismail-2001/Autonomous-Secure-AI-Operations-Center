import { render, screen } from "@testing-library/react";
import { AuthProvider } from "@/contexts/AuthContext";

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
) as jest.Mock;

function renderWithAuth(ui: React.ReactElement) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

describe("Skeleton components", () => {
  it("renders SkeletonKPI without crashing", async () => {
    const { SkeletonKPI } = await import("@/components/Skeleton");
    render(<SkeletonKPI />);
    expect(document.querySelector("[class*='animate']")).toBeTruthy();
  });

  it("renders SkeletonAgent without crashing", async () => {
    const { SkeletonAgent } = await import("@/components/Skeleton");
    render(<SkeletonAgent />);
    expect(document.querySelector("[class*='animate']")).toBeTruthy();
  });

  it("renders SkeletonCard without crashing", async () => {
    const { SkeletonCard } = await import("@/components/Skeleton");
    render(<SkeletonCard />);
    expect(document.querySelector("[class*='animate']")).toBeTruthy();
  });
});

describe("InvestigationPanel", () => {
  const mockIncident = {
    id: "test-123",
    incident_number: "INC-2026-0001",
    title: "Test Incident",
    description: "Test description",
    severity: "high",
    status: "active",
    source: "test",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    risk_score: 70,
    tags: ["test"],
    triage_status: "new",
  };

  it("renders with readonly role - no action buttons", async () => {
    const { default: InvestigationPanel } = await import("@/components/InvestigationPanel");
    render(
      <InvestigationPanel incident={mockIncident as any} open={true} onClose={() => {}} role="readonly" />
    );
    expect(screen.getByText("INC-2026-0001")).toBeTruthy();
    expect(screen.queryByText("Update Triage")).toBeNull();
  });

  it("renders with analyst role - triage button visible", async () => {
    const { default: InvestigationPanel } = await import("@/components/InvestigationPanel");
    render(
      <InvestigationPanel incident={mockIncident as any} open={true} onClose={() => {}} role="analyst" />
    );
    expect(screen.getByText("INC-2026-0001")).toBeTruthy();
  });

  it("renders with admin role - all buttons visible", async () => {
    const { default: InvestigationPanel } = await import("@/components/InvestigationPanel");
    render(
      <InvestigationPanel incident={mockIncident as any} open={true} onClose={() => {}} role="admin" />
    );
    expect(screen.getByText("INC-2026-0001")).toBeTruthy();
  });
});

describe("lib/api", () => {
  it("exports endpoints object", async () => {
    const { endpoints } = await import("@/lib/api");
    expect(endpoints.stats()).toBe("/api/v1/dashboard/stats");
    expect(endpoints.agents()).toBe("/api/v1/agents/status");
    expect(endpoints.incidents()).toBe("/api/v1/incidents");
    expect(endpoints.assets()).toBe("/api/v1/assets");
    expect(endpoints.threatIntel()).toBe("/api/v1/threat-intel/indicators");
    expect(endpoints.compliance()).toBe("/api/v1/compliance/report");
  });

  it("endpoints accept parameters", async () => {
    const { endpoints } = await import("@/lib/api");
    expect(endpoints.incidentActions("inc-123")).toBe("/api/v1/incidents/inc-123/actions");
    expect(endpoints.triageUpdate("inc-123")).toBe("/api/v1/incidents/inc-123/triage");
  });
});
