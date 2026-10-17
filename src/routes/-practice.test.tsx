import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { PracticeWorkspace } from "./practice";
import {
  fetchSolutionAccess,
  revealSolution,
  practiceAction,
  startPractice,
  fetchPractice,
} from "../lib/api";

vi.mock("../lib/api", () => ({
  fetchTrackItems: vi
    .fn()
    .mockResolvedValue([
      {
        id: "javascript-path-01-values",
        starter_code: "function totalCost(price, quantity) {}",
      },
    ]),
  fetchSolutionAccess: vi.fn(),
  revealSolution: vi.fn(),
  practiceAction: vi.fn(),
  startPractice: vi.fn(),
  fetchPractice: vi.fn(),
  getApiErrorMessage: () => "Service unavailable",
}));
vi.mock("../lib/auth", () => ({
  hasToken: () => true,
  useAuth: () => ({
    setBalance: vi.fn(),
    user: { preferred_language: "javascript" },
  }),
}));
vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      aria-label="Code"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
vi.mock("../components/ProblemStatement", () => ({
  ProblemStatement: () => <p>Problem statement</p>,
}));
vi.mock("../components/MentorPanel", () => ({
  MentorPanel: ({
    requestHint,
    disabled,
  }: {
    requestHint: (r: string) => Promise<unknown>;
    disabled: boolean;
  }) => (
    <button
      disabled={disabled}
      onClick={() => {
        void requestHint("My reasoning").catch(() => {});
      }}
    >
      Ask practice hint
    </button>
  ),
}));
vi.mock("../components/AnalysisPanel", () => ({
  AnalysisPanel: () => <p>Evaluation feedback</p>,
}));
vi.mock("../components/EvidencePanel", () => ({
  EvidencePanel: () => <p>Execution evidence</p>,
}));

const baseReply = {
  session_id: "practice-one",
  awaiting: "learner" as const,
  outcome: "",
  reply: "",
  analysis: null,
  evidence: null,
  hint_tier: 0,
  tier_label: "",
  step_back: null,
  peppercorns_remaining: 45,
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(startPractice).mockResolvedValue(baseReply);
  vi.mocked(fetchPractice).mockResolvedValue(baseReply);
  vi.mocked(fetchSolutionAccess).mockResolvedValue(false);
  vi.mocked(revealSolution).mockResolvedValue("Reference answer");
  vi.mocked(practiceAction).mockResolvedValue({
    ...baseReply,
    awaiting: "reflection",
    analysis: {
      mistakes: [],
      enhancements: [],
      watchouts: [],
      interview_tips: [],
      overall_feedback: "Reviewed",
    },
    solution_available: true,
    peppercorns_remaining: 45,
  });
});
const show = () =>
  render(
    <PracticeWorkspace
      problemId="javascript-path-01-values"
      language="javascript"
    />,
  );

async function submit() {
  const button = screen.getByRole("button", { name: "Submit for evaluation" });
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  await act(async () => {
    fireEvent.click(button);
  });
}

describe("Optional solution reveal", () => {
  it("fetches the answer only after completed evaluation and an explicit click", async () => {
    show();
    expect(
      screen.queryByRole("button", { name: "Reveal solution" }),
    ).toBeNull();
    await submit();
    const reveal = await screen.findByRole("button", {
      name: "Reveal solution",
    });
    expect(revealSolution).not.toHaveBeenCalled();
    expect(screen.queryByText("Reference answer")).toBeNull();
    await act(async () => {
      fireEvent.click(reveal);
    });
    await screen.findByText("Reference answer");
    expect(revealSolution).toHaveBeenCalledWith(
      "javascript-path-01-values",
      "javascript",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hide solution" }));
    });
    expect(screen.queryByText("Reference answer")).toBeNull();
  });
  it("restores access after reload without fetching the answer", async () => {
    vi.mocked(fetchSolutionAccess).mockResolvedValue(true);
    show();
    await screen.findByRole("button", { name: "Reveal solution" });
    expect(revealSolution).not.toHaveBeenCalled();
  });
  it("keeps the solution locked when execution is unavailable", async () => {
    vi.mocked(practiceAction).mockResolvedValue({
      ...baseReply,
      analysis: {
        mistakes: [],
        enhancements: [],
        watchouts: [],
        interview_tips: [],
        overall_feedback: "Unverified",
      },
      solution_available: false,
      peppercorns_remaining: 45,
    });
    show();
    await submit();
    await screen.findByText("Evaluation feedback");
    expect(
      screen.queryByRole("button", { name: "Reveal solution" }),
    ).toBeNull();
  });
  it("keeps provider errors locked", async () => {
    vi.mocked(practiceAction).mockRejectedValue(new Error("down"));
    show();
    await submit();
    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "Reveal solution" }),
    ).toBeNull();
  });
});

it("routes hints through the active graph session", async () => {
  show();
  const button = screen.getByRole("button", { name: "Ask practice hint" });
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  await act(async () => {
    fireEvent.click(button);
  });
  expect(startPractice).toHaveBeenCalledWith(
    "javascript-path-01-values",
    "javascript",
    "gemini",
  );
  expect(practiceAction).toHaveBeenCalledWith(
    "practice-one",
    "hint",
    expect.any(String),
    "My reasoning",
  );
});

it("restores a graph awaiting reflection and saves it through the graph", async () => {
  sessionStorage.setItem(
    "dsa_practice:local:javascript-path-01-values:javascript:gemini",
    "practice-one",
  );
  vi.mocked(fetchPractice).mockResolvedValue({
    ...baseReply,
    awaiting: "reflection",
    current_code: "function totalCost(a,b){return a*b;}",
  });
  show();
  const textarea = await screen.findByRole("textbox", {
    name: "Your reflection",
  });
  expect(
    (screen.getByRole("textbox", { name: "Code" }) as HTMLTextAreaElement)
      .value,
  ).toContain("return a*b");
  fireEvent.change(textarea, {
    target: { value: "I represented repeated costs with multiplication." },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
  });
  expect(practiceAction).toHaveBeenCalledWith(
    "practice-one",
    "reflect",
    "",
    "I represented repeated costs with multiplication.",
  );
});
