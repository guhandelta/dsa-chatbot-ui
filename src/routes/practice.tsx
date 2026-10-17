import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import { AnalysisPanel } from "../components/AnalysisPanel";
import { EvidencePanel } from "../components/EvidencePanel";
import { MentorPanel } from "../components/MentorPanel";
import { LanguageSelector } from "../components/LanguageSelector";
import { ProviderSelector } from "../components/ProviderSelector";
import { ProblemPicker } from "../components/ProblemPicker";
import { ProblemStatement } from "../components/ProblemStatement";
import {
  fetchTrackItems,
  fetchSolutionAccess,
  revealSolution,
  getApiErrorMessage,
  startPractice,
  fetchPractice,
  practiceAction,
} from "../lib/api";
import { hasToken, useAuth } from "../lib/auth";
import type { PracticeReply } from "../lib/api";
import type { AnalysisResult, Evidence, Provider } from "../types";

export const Route = createFileRoute("/practice")({
  beforeLoad: () => {
    if (!hasToken()) throw redirect({ to: "/login" });
  },
  validateSearch: (search: Record<string, unknown>): { problem?: string } => ({
    problem: typeof search.problem === "string" ? search.problem : undefined,
  }),
  component: PracticePage,
});

function PracticePage() {
  const { user } = useAuth();
  const { problem: preselected } = Route.useSearch();
  const [language, setLanguage] = useState(
    user?.preferred_language === "java" ? "java" : "javascript",
  );
  const [problemId, setProblemId] = useState(preselected ?? "");
  useEffect(() => {
    if (
      user?.preferred_language === "java" ||
      user?.preferred_language === "javascript"
    )
      setLanguage(user.preferred_language);
  }, [user?.preferred_language]);
  useEffect(() => {
    setProblemId(preselected ?? "");
  }, [preselected]);
  const exerciseLanguage = /^(java|javascript)-path-/.exec(problemId)?.[1];
  const activeLanguage = exerciseLanguage ?? language;
  return (
    <main className="page-wrap px-4 py-8">
      <Link to="/learn">← Learning home</Link>
      <h1 className="display-title my-4 text-3xl font-bold">
        Practice and reflect
      </h1>
      <div className="controls mb-4">
        {exerciseLanguage ? (
          <span>
            Language exercise ·{" "}
            {activeLanguage === "java" ? "Java" : "JavaScript"}
          </span>
        ) : (
          <>
            <ProblemPicker value={problemId} onChange={setProblemId} />
            <LanguageSelector value={language} onChange={setLanguage} />
          </>
        )}
        {exerciseLanguage && (
          <Link
            to="/track/$track"
            params={{ track: "language" }}
            search={{ mode: "browse" }}
          >
            All language lessons
          </Link>
        )}
      </div>
      {problemId && (
        <PracticeWorkspace
          key={`${problemId}:${activeLanguage}`}
          problemId={problemId}
          language={activeLanguage}
        />
      )}
    </main>
  );
}

export function PracticeWorkspace({
  problemId,
  language,
}: {
  problemId: string;
  language: string;
}) {
  const [code, setCode] = useState("// Write your solution here.\n");
  const [provider, setProvider] = useState<Provider>("gemini");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(false);
  const [solution, setSolution] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const { setBalance, user } = useAuth();
  const [practice, setPractice] = useState<PracticeReply | null>(null);
  const [reflection, setReflection] = useState("");
  const sessionRef = useRef<PracticeReply | null>(null);
  const sessionSlot = `dsa_practice:${user?.id ?? "local"}:${problemId}:${language}:${provider}`;
  const applyPractice = (value: PracticeReply) => {
    sessionRef.current = value;
    setPractice(value);
    sessionStorage.setItem(sessionSlot, value.session_id);
    if (value.analysis) setAnalysis(value.analysis);
    if (value.evidence) setEvidence(value.evidence);
    if (value.solution_available) setAvailable(true);
    if (value.peppercorns_remaining !== null)
      setBalance(value.peppercorns_remaining);
  };
  const ensureSession = async () => {
    let current = sessionRef.current;
    if (current?.awaiting === "reflection") {
      await practiceAction(current.session_id, "quit");
      current = null;
    }
    if (!current?.awaiting)
      current = await startPractice(problemId, language, provider);
    applyPractice(current);
    return current.session_id;
  };
  useEffect(() => {
    let active = true;
    setReady(false);
    sessionRef.current = null;
    setPractice(null);
    const load = async () => {
      try {
        const items = await fetchTrackItems("language", { language });
        if (!active) return;
        const item = items.find((i) => i.id === problemId);
        setCode(
          item?.starter_code ||
            (language === "java"
              ? "// Define the problem method in Java.\n"
              : "// Define the problem function in JavaScript.\n"),
        );
        const saved = sessionStorage.getItem(sessionSlot);
        if (saved) {
          try {
            const value = await fetchPractice(saved);
            if (!active) return;
            applyPractice(value);
            if (value.current_code) setCode(value.current_code);
          } catch (e) {
            if (active) {
              sessionStorage.removeItem(sessionSlot);
              setError(getApiErrorMessage(e));
            }
          }
        }
      } catch (e) {
        if (active) setError(getApiErrorMessage(e));
      } finally {
        if (active) setReady(true);
      }
    };
    void load();
    fetchSolutionAccess(problemId, language)
      .then((value) => {
        if (active) setAvailable((previous) => previous || value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [problemId, language, provider, sessionSlot]);
  const handleSubmit = async () => {
    if (loading || !ready || !code.trim()) return;
    setLoading(true);
    setError(null);
    setSolution(null);
    setAnalysis(null);
    setEvidence(null);
    try {
      const sid = await ensureSession();
      applyPractice(await practiceAction(sid, "submit", code));
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  const requestHint = async (reasoning: string) => {
    setLoading(true);
    try {
      const sid = await ensureSession();
      const value = await practiceAction(sid, "hint", code, reasoning);
      applyPractice(value);
      return {
        reply: value.reply,
        hint_tier: value.hint_tier,
        tier_label: value.tier_label,
        recalled_moment: value.recalled_moment ?? null,
        step_back_offer: value.step_back,
        peppercorns_remaining: value.peppercorns_remaining ?? 0,
      };
    } finally {
      setLoading(false);
    }
  };
  const finishReflection = async (skip: boolean) => {
    if (!practice || loading) return;
    setLoading(true);
    setError(null);
    try {
      applyPractice(
        await practiceAction(
          practice.session_id,
          skip ? "quit" : "reflect",
          "",
          reflection,
        ),
      );
      setReflection("");
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  const handleReveal = async () => {
    if (revealing) return;
    setRevealing(true);
    setError(null);
    try {
      setSolution(await revealSolution(problemId, language));
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setRevealing(false);
    }
  };
  return (
    <>
      <ProblemStatement problemId={problemId} />
      <section className="island-shell mt-4 rounded-2xl p-5">
        <fieldset disabled={loading}>
          <ProviderSelector value={provider} onChange={setProvider} />
        </fieldset>
        <div className="editor-frame my-4">
          <Editor
            height="400px"
            language={language}
            value={code}
            onChange={(v) => setCode(v ?? "")}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              readOnly: !ready || loading,
            }}
          />
        </div>
        {error && (
          <div className="error-banner mb-3" role="alert">
            {error}
          </div>
        )}
        <button
          type="button"
          className="primary-btn"
          disabled={!ready || loading || !code.trim()}
          onClick={handleSubmit}
        >
          {loading ? "Evaluating…" : "Submit for evaluation"}
        </button>
        <p className="cost-note mt-2">
          Evaluation costs 5 peppercorns. A completed test evaluation unlocks
          the optional solution.
        </p>
      </section>
      <div className="mt-4">
        <MentorPanel
          problemId={problemId}
          language={language}
          currentCode={code}
          provider={provider}
          requestHint={requestHint}
          disabled={!ready || loading}
          onStepBack={(target) => {
            window.location.href =
              target.kind === "problem"
                ? `/practice?problem=${encodeURIComponent(target.id)}`
                : "/track/dsa?mode=browse";
          }}
        />
      </div>
      {practice?.awaiting === "reflection" && (
        <section className="island-shell my-4 rounded-2xl p-5">
          <h2 className="text-lg font-bold">What made the solution work?</h2>
          <p className="my-2 text-sm">
            Optional and free. Record your reasoning without changing your
            completed evaluation.
          </p>
          <textarea
            aria-label="Your reflection"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            maxLength={4000}
            className="w-full rounded border p-3"
          />
          <button
            type="button"
            className="primary-btn mr-3"
            disabled={loading || !reflection.trim()}
            onClick={() => finishReflection(false)}
          >
            Save reflection
          </button>
          <button
            type="button"
            className="lang-tab"
            disabled={loading}
            onClick={() => finishReflection(true)}
          >
            Skip reflection
          </button>
        </section>
      )}
      {evidence && <EvidencePanel evidence={evidence} />}
      {analysis && <AnalysisPanel result={analysis} />}
      <section
        className="island-shell mt-4 rounded-2xl p-5"
        aria-label="Reference solution"
      >
        <h2 className="mb-2 text-lg font-bold">Reference solution</h2>
        {available ? (
          solution ? (
            <>
              <button
                type="button"
                className="lang-tab mb-3"
                onClick={() => setSolution(null)}
              >
                Hide solution
              </button>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{solution}</ReactMarkdown>
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm">
                Your evaluation is complete. Keep working, ask for a hint, or
                reveal the solution when you are ready.
              </p>
              <button
                type="button"
                className="primary-btn"
                disabled={revealing || loading}
                onClick={handleReveal}
              >
                {revealing ? "Loading…" : "Reveal solution"}
              </button>
            </>
          )
        ) : (
          <p className="text-sm">
            Submit your code and complete evaluation to unlock the solution.
            Unavailable runtimes and service errors do not unlock it.
          </p>
        )}
      </section>
    </>
  );
}
