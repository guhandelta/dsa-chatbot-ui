import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
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
import { LANGUAGE_LABELS, useLanguageAccess } from "../lib/languageAccess";
import type { PracticeReply } from "../lib/api";
import {
  createCheckpoint,
  deleteCheckpoint,
  fetchSessionSummary,
  openWorkspace,
  resetWorkspace,
  restoreCheckpoint,
  runWorkspaceTests,
  type CheckpointSummary,
  type RevealPolicy,
  type SessionSummary,
  type TestRun,
  type WorkspaceDraft,
  type WorkspaceFile,
  type WorkspaceProgress,
  type WorkspaceTemplate,
} from "../lib/workspaceApi";
import { FileTabs, isNotes } from "../components/workspace/FileTabs";
import { TestOutput } from "../components/workspace/TestOutput";
import { CheckpointsPanel } from "../components/workspace/CheckpointsPanel";
import { ProgressPanel } from "../components/workspace/ProgressPanel";
import { SessionSummaryCard } from "../components/workspace/SessionSummaryCard";
import { useAutosave } from "../components/workspace/useAutosave";
import type { AnalysisResult, Evidence, Provider } from "../types";

export const Route = createFileRoute("/practice")({
  beforeLoad: () => {
    if (!hasToken()) throw redirect({ to: "/login" });
  },
  validateSearch: (search: Record<string, unknown>): { problem?: string; language?: string } => ({
    problem: typeof search.problem === "string" ? search.problem : undefined,
    // The Study Room links problems in the language of the learner's path.
    language: typeof search.language === "string" ? search.language : undefined,
  }),
  component: PracticePage,
});

// Every language with a server-side runner and exercises.
const PRACTICE_LANGUAGES = ["javascript", "java", "python", "cpp", "c", "rust", "typescript", "ruby", "go", "csharp"];

function PracticePage() {
  const { user } = useAuth();
  const access = useLanguageAccess();
  const { problem: preselected, language: requested } = Route.useSearch();
  const [language, setLanguage] = useState(
    requested ?? user?.preferred_language ?? "",
  );
  const [problemId, setProblemId] = useState(preselected ?? "");
  useEffect(() => {
    if (requested) setLanguage(requested);
    else if (user?.preferred_language)
      setLanguage(user.preferred_language);
  }, [user?.preferred_language, requested]);
  useEffect(() => {
    setProblemId(preselected ?? "");
  }, [preselected]);
  const exerciseLanguage = /^(java|javascript|python|typescript|c|cpp|rust|go|csharp|ruby)-path-/.exec(problemId)?.[1];
  const practiceLanguages = (access.data?.languages ?? []).filter(l => PRACTICE_LANGUAGES.includes(l));
  const activeLanguage = exerciseLanguage ?? (practiceLanguages.includes(language) ? language : practiceLanguages[0] ?? "");
  return (
    <main className="page-wrap px-4 py-8">
      <div className="practice-chrome">
        <Link to="/learn">← Learning home</Link>
        <h1 className="display-title my-4 text-3xl font-bold">
          Practice and reflect
        </h1>
      </div>
      <div className="controls practice-chrome mb-4">
        {exerciseLanguage ? (
          <span>
            Language exercise ·{" "}
            {LANGUAGE_LABELS[activeLanguage] ?? activeLanguage}
          </span>
        ) : (
          <>
            <ProblemPicker value={problemId} onChange={setProblemId} />
            <LanguageSelector value={language} onChange={setLanguage} supported={PRACTICE_LANGUAGES} />
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
      {access.isError && <p role="alert">Language access could not be loaded.</p>}
      {access.data && !access.data.languages.length && <p>No practice languages are available for your account.</p>}
      {access.data && access.data.languages.length > 0 && !activeLanguage && <p>These languages currently provide reference learning. Open Chat to study the available material.</p>}
      {exerciseLanguage && access.data && !access.data.languages.includes(exerciseLanguage) && <p>This exercise is outside your current language access.</p>}
      {problemId && !access.isError && access.data?.languages.includes(activeLanguage) && (
        <PracticeWorkspace
          key={`${problemId}:${activeLanguage}`}
          problemId={problemId}
          language={activeLanguage}
        />
      )}
    </main>
  );
}

const MONACO_LANGUAGE: Record<string, string> = {
  py: "python", js: "javascript", ts: "typescript", java: "java", c: "c", h: "cpp",
  cpp: "cpp", hpp: "cpp", rs: "rust", rb: "ruby", go: "go", cs: "csharp", md: "markdown", txt: "plaintext",
};
const monacoLanguage = (name: string, fallback: string) =>
  MONACO_LANGUAGE[name.split(".").pop() ?? ""] ?? fallback;

const fallbackStarter = (language: string) =>
  `${language === "python" || language === "ruby" ? "#" : "//"} Define the problem function in ${LANGUAGE_LABELS[language] ?? language}.\n`;
const FALLBACK_ENTRY: Record<string, string> = {
  python: "solution.py", javascript: "solution.js", typescript: "solution.ts", java: "Solution.java",
  c: "solution.c", cpp: "solution.cpp", rust: "solution.rs", ruby: "solution.rb", go: "solution.go", csharp: "Solution.cs",
};

const SAVE_LABEL = {
  idle: "Not saved yet",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  saved: "All changes saved",
  conflict: "Saved elsewhere",
  error: "Autosave failed",
  offline: "Autosave unavailable: your work stays in this tab",
} as const;

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

export function PracticeWorkspace({
  problemId,
  language,
}: {
  problemId: string;
  language: string;
}) {
  const [files, setFiles] = useState<WorkspaceFile[]>([
    { name: FALLBACK_ENTRY[language] ?? "solution.txt", content: "" },
  ]);
  const [entry, setEntry] = useState(FALLBACK_ENTRY[language] ?? "solution.txt");
  const [activeFile, setActiveFile] = useState(entry);
  const [template, setTemplate] = useState("single");
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [multiFile, setMultiFile] = useState(false);
  const [maxFiles, setMaxFiles] = useState(8);
  const [checkpoints, setCheckpoints] = useState<CheckpointSummary[]>([]);
  const [progress, setProgress] = useState<WorkspaceProgress | null>(null);
  const [reveal, setReveal] = useState<RevealPolicy | null>(null);
  const [serverWorkspace, setServerWorkspace] = useState(false);
  const [testRun, setTestRun] = useState<{ result: TestRun; source: "run" | "evaluation" } | null>(null);
  const [running, setRunning] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [summary, setSummary] = useState<SessionSummary | null>(null);

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
  const context = useRef(sessionSlot);
  context.current = sessionSlot;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isCurrent = () => mounted.current && context.current === sessionSlot;
  const autosave = useAutosave(problemId, language, serverWorkspace);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const jumpTo = useRef<{ file: string; line: number } | null>(null);

  const code = files.find((f) => f.name === entry)?.content ?? "";
  const codeFiles = files.filter((f) => !isNotes(f.name));
  const hasCode = codeFiles.some((f) => f.content.trim());
  // Single-file workspaces keep the original request shape; anything more is
  // bundled by the server so helpers and notes are handled consistently.
  const workspacePayload = files.length > 1 ? { files, entry } : undefined;

  const applyDraft = (draft: WorkspaceDraft) => {
    setFiles(draft.files);
    setEntry(draft.entry);
    setTemplate(draft.template);
    setActiveFile((current) => (draft.files.some((f) => f.name === current) ? current : draft.entry));
    autosave.adopt(draft.revision, draft.updated_at);
  };
  const updateFiles = (next: WorkspaceFile[], nextEntry = entry) => {
    setFiles(next);
    autosave.schedule({ files: next, entry: nextEntry, template });
  };
  const editActive = (content: string) =>
    updateFiles(files.map((f) => (f.name === activeFile ? { ...f, content } : f)));

  const applyPractice = (value: PracticeReply) => {
    if (!isCurrent()) return;
    sessionRef.current = value;
    setPractice(value);
    sessionStorage.setItem(sessionSlot, value.session_id);
    if (value.analysis) setAnalysis(value.analysis);
    if (value.evidence) setEvidence(value.evidence);
    if (value.tests) setTestRun({ result: { ...value.tests, source_map: value.source_map }, source: "evaluation" });
    if (value.solution_available) setAvailable(true);
    if (value.peppercorns_remaining !== null)
      setBalance(value.peppercorns_remaining);
  };
  const ensureSession = async () => {
    let current = sessionRef.current;
    if (current?.awaiting === "reflection") {
      await practiceAction(current.session_id, "quit");
      if (!isCurrent()) throw new Error("Practice context changed");
      current = null;
    }
    if (!current?.awaiting)
      current = await startPractice(problemId, language, provider);
    if (!isCurrent()) throw new Error("Practice context changed");
    applyPractice(current);
    return current.session_id;
  };
  const refreshWorkspace = useCallback(async () => {
    try {
      const state = await openWorkspace(problemId, language);
      if (!mounted.current) return;
      setCheckpoints(state.checkpoints);
      setProgress(state.progress);
      setReveal(state.reveal);
      if (state.reveal.available) setAvailable(true);
    } catch {
      // Progress panels are optional; the editor keeps working without them.
    }
  }, [problemId, language]);

  useEffect(() => {
    let active = true;
    setReady(false);
    sessionRef.current = null;
    setPractice(null);
    const load = async () => {
      let starter = fallbackStarter(language);
      try {
        const items = await fetchTrackItems("language", { language });
        if (!active) return;
        starter = items.find((i) => i.id === problemId)?.starter_code || starter;
      } catch (e) {
        if (active) setError(getApiErrorMessage(e));
      }
      let restoredDraft = false;
      let entryName = FALLBACK_ENTRY[language] ?? "solution.txt";
      try {
        const state = await openWorkspace(problemId, language);
        if (!active) return;
        setServerWorkspace(true);
        setTemplates(state.templates);
        setMultiFile(state.multi_file);
        setMaxFiles(state.limits.max_files);
        setCheckpoints(state.checkpoints);
        setProgress(state.progress);
        setReveal(state.reveal);
        if (state.reveal.available) setAvailable(true);
        applyDraft(state.draft);
        restoredDraft = state.draft.revision !== null;
        entryName = state.draft.entry;
      } catch {
        if (!active) return;
        setFiles([{ name: entryName, content: starter }]);
        setEntry(entryName);
        setActiveFile(entryName);
      }
      const saved = sessionStorage.getItem(sessionSlot);
      if (saved) {
        try {
          const value = await fetchPractice(saved);
          if (!active) return;
          applyPractice(value);
          // An autosaved draft is newer than the last submission.
          if (value.current_code && !restoredDraft) {
            const submitted = value.current_code;
            setFiles((current) => current.map((f) => (f.name === entryName ? { ...f, content: submitted } : f)));
          }
        } catch (e) {
          if (active) {
            sessionStorage.removeItem(sessionSlot);
            setError(getApiErrorMessage(e));
          }
        }
      }
      if (active) setReady(true);
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

  const runTests = async () => {
    if (running || loading || !ready || !hasCode) return;
    setRunning(true);
    setWorkspaceError(null);
    try {
      const result = await runWorkspaceTests(problemId, { language, files, entry });
      if (!mounted.current) return;
      setTestRun({ result, source: "run" });
      setAnnouncement(result.status === "passed" ? `All ${result.total} tests passed.` : `${result.passed} of ${result.total} tests passed.`);
      void refreshWorkspace();
    } catch (e) {
      if (mounted.current) setWorkspaceError(getApiErrorMessage(e));
    } finally {
      if (mounted.current) setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (loading || !ready || !hasCode) return;
    setLoading(true);
    setError(null);
    setSolution(null);
    setAnalysis(null);
    setEvidence(null);
    try {
      await autosave.flush();
      const sid = await ensureSession();
      applyPractice(await practiceAction(sid, "submit", code, "", undefined, workspacePayload));
      void refreshWorkspace();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };
  const requestHint = async (reasoning: string, maxCost = 0) => {
    setLoading(true);
    try {
      const sid = await ensureSession();
      const value = workspacePayload
        ? await practiceAction(sid, "hint", code, reasoning, maxCost, workspacePayload)
        : await practiceAction(sid, "hint", code, reasoning, maxCost);
      applyPractice(value);
      return {
        reply: value.reply,
        hint_tier: value.hint_tier,
        tier_label: value.tier_label,
        recalled_moment: value.recalled_moment ?? null,
        step_back_offer: value.step_back,
        peppercorns_remaining: value.peppercorns_remaining ?? 0,
        peppercorns_charged: value.peppercorns_charged ?? 0,
        next_hint_cost: value.next_hint_cost,
      };
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };
  const showSummary = async (sid: string) => {
    try {
      const value = await fetchSessionSummary(sid);
      if (isCurrent()) setSummary(value);
    } catch {
      // A missing summary should not block finishing the session.
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
      void showSummary(practice.session_id);
      void refreshWorkspace();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };
  const endSession = async () => {
    if (!practice || loading) return;
    setLoading(true);
    setError(null);
    try {
      applyPractice(await practiceAction(practice.session_id, "quit"));
      void showSummary(practice.session_id);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };
  const practiceAgain = () => {
    sessionRef.current = null;
    sessionStorage.removeItem(sessionSlot);
    setPractice(null);
    setSummary(null);
    setAnalysis(null);
    setEvidence(null);
    setTestRun(null);
    editorRef.current?.focus();
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

  const workspaceAction = async (action: () => Promise<void>) => {
    setWorkspaceError(null);
    try {
      await action();
    } catch (e) {
      setWorkspaceError(getApiErrorMessage(e));
    }
  };
  const saveCheckpoint = (label: string) => workspaceAction(async () => {
    const made = await createCheckpoint(problemId, { language, files, entry, label });
    setCheckpoints((list) => [made, ...list]);
    setAnnouncement(`Checkpoint “${made.label}” saved.`);
  });
  const restore = (id: string) => workspaceAction(async () => {
    applyDraft(await restoreCheckpoint(problemId, id));
    await refreshWorkspace();
    setAnnouncement("Checkpoint restored. Your previous files were saved as a checkpoint.");
  });
  const removeCheckpoint = (id: string) => workspaceAction(async () => {
    await deleteCheckpoint(problemId, id);
    setCheckpoints((list) => list.filter((c) => c.id !== id));
  });
  const reset = (nextTemplate: string) => workspaceAction(async () => {
    applyDraft(await resetWorkspace(problemId, language, nextTemplate));
    setTestRun(null);
    await refreshWorkspace();
    setAnnouncement("Workspace reset. Your previous files were saved as a checkpoint.");
  });
  const loadSaved = () => workspaceAction(async () => {
    applyDraft((await openWorkspace(problemId, language)).draft);
  });

  const jump = (file: string, line: number) => {
    jumpTo.current = { file, line };
    if (file === activeFile) applyJump();
    else setActiveFile(file);
  };
  const applyJump = () => {
    const target = jumpTo.current;
    const editor = editorRef.current;
    if (!target || !editor) return;
    jumpTo.current = null;
    editor.revealLineInCenter(target.line);
    editor.setPosition({ lineNumber: target.line, column: 1 });
    editor.focus();
  };
  useEffect(() => { applyJump(); }, [activeFile]);

  // Latest handlers for keyboard shortcuts registered once on the editor.
  const shortcuts = useRef({ run: runTests, checkpoint: () => saveCheckpoint("") });
  shortcuts.current = { run: runTests, checkpoint: () => saveCheckpoint("") };
  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => void shortcuts.current.run());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void shortcuts.current.checkpoint());
    // Ctrl+Alt+F (focus mode) is handled on window so it works everywhere.
    applyJump();
  };
  const onWorkspaceKey = (event: React.KeyboardEvent) => {
    if ((event.target as HTMLElement).closest?.(".monaco-editor")) return;
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key === "Enter") { event.preventDefault(); void runTests(); }
    if (mod && event.key.toLowerCase() === "s") { event.preventDefault(); void saveCheckpoint(""); }
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && event.code === "KeyF") {
        event.preventDefault();
        setFocusMode((v) => !v);
      } else if (event.key === "Escape" && focusMode && !(event.target as HTMLElement | null)?.closest?.(".monaco-editor")) {
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);
  useEffect(() => {
    document.body.classList.toggle("practice-focus", focusMode);
    setAnnouncement(focusMode ? "Focus mode on. Press Escape outside the editor, or Ctrl+Alt+F, to exit." : "");
    if (focusMode) editorRef.current?.focus();
    return () => document.body.classList.remove("practice-focus");
  }, [focusMode]);

  const active = files.find((f) => f.name === activeFile) ?? files[0];
  const busy = !ready || loading;
  const sessionOpen = practice?.awaiting === "learner";
  return (
    <div className={focusMode ? "practice-workspace is-focus" : "practice-workspace"}>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      {focusMode ? (
        <details className="island-shell mb-3 rounded-2xl p-4">
          <summary>Problem statement</summary>
          <ProblemStatement problemId={problemId} language={language} />
        </details>
      ) : (
        <ProblemStatement problemId={problemId} language={language} />
      )}
      <div className="practice-grid mt-4">
        <div className="practice-main">
          <section className="island-shell rounded-2xl p-5" aria-label="Code workspace" onKeyDown={onWorkspaceKey}>
            <div className="ws-toolbar">
              <fieldset disabled={loading} className="practice-chrome">
                <ProviderSelector value={provider} onChange={setProvider} />
              </fieldset>
              <button type="button" className="lang-tab" aria-pressed={focusMode} aria-keyshortcuts="Control+Alt+F"
                onClick={() => setFocusMode((v) => !v)}>
                {focusMode ? "Exit focus mode" : "Focus mode"}
              </button>
              <span className={`ws-save is-${autosave.status}`} role="status">
                {SAVE_LABEL[autosave.status]}
              </span>
            </div>
            {autosave.status === "conflict" && (
              <div className="error-banner my-2" role="alert">
                This workspace was saved from another tab or device.{" "}
                <button type="button" className="lang-tab" onClick={() => void loadSaved()}>Load saved version</button>{" "}
                <button type="button" className="lang-tab" onClick={() => void autosave.keepMine()}>Keep my version</button>
              </div>
            )}
            {autosave.status === "error" && autosave.error && (
              <p className="ws-error" role="alert">
                {autosave.error}{" "}
                <button type="button" className="lang-tab" onClick={() => void autosave.flush()}>Retry save</button>
              </p>
            )}
            <FileTabs
              files={files}
              active={active.name}
              entry={entry}
              language={language}
              multiFile={multiFile}
              maxFiles={maxFiles}
              disabled={busy || !serverWorkspace}
              onSelect={setActiveFile}
              onAdd={(name) => {
                updateFiles([...files, { name, content: "" }]);
                setActiveFile(name);
                // Move focus from the removed name field straight to the new file.
                requestAnimationFrame(() => editorRef.current?.focus());
              }}
              onRemove={(name) => {
                updateFiles(files.filter((f) => f.name !== name));
                if (activeFile === name) setActiveFile(entry);
              }}
            />
            <div className="editor-frame my-3" id="ws-editor-panel" role="tabpanel" aria-labelledby={`ws-tab-${active.name}`}>
              <Editor
                height={focusMode ? "70vh" : "400px"}
                path={`${problemId}/${language}/${active.name}`}
                language={monacoLanguage(active.name, language)}
                value={active.content}
                onChange={(v) => editActive(v ?? "")}
                onMount={onMount}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  readOnly: busy,
                  ariaLabel: `${active.name} editor`,
                }}
              />
            </div>
            <p className="ws-hint">
              Shortcuts: {MOD}+Enter runs the tests, {MOD}+S saves a checkpoint, Ctrl+Alt+F toggles focus mode.
              In the editor, Ctrl+M switches Tab between indenting and moving focus.
            </p>
            {error && (
              <div className="error-banner mb-3" role="alert">
                {error}
              </div>
            )}
            {workspaceError && <p className="ws-error" role="alert">{workspaceError}</p>}
            <div className="ws-row">
              <button
                type="button"
                className="lang-tab"
                disabled={busy || running || !hasCode || !serverWorkspace}
                onClick={() => void runTests()}
                aria-keyshortcuts={isMac ? "Meta+Enter" : "Control+Enter"}
              >
                {running ? "Running tests…" : "Run tests"}
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={busy || !hasCode}
                onClick={handleSubmit}
              >
                {loading ? "Evaluating…" : "Submit for evaluation"}
              </button>
              {sessionOpen && (
                <button type="button" className="lang-tab" disabled={loading} onClick={() => void endSession()}>
                  End session
                </button>
              )}
            </div>
            <p className="cost-note mt-2">
              Test runs are free and check the curated tests only. Evaluation
              costs 5 peppercorns and adds a review. Solving it for the first
              time without hints 3–4 earns 3 peppercorns back.
            </p>
            {practice?.rewards?.map((reward) => (
              <p key={reward.key} className="mt-2 text-sm" role="status">
                +{reward.amount} peppercorns{" "}
                {reward.reason === "earn:independent_solve"
                  ? "for solving it on your own"
                  : reward.reason === "earn:stage"
                    ? "for completing a stage"
                    : "for your learning streak"}
              </p>
            ))}
          </section>
          {testRun && <TestOutput result={testRun.result} source={testRun.source} onJump={jump} />}
          {summary && <SessionSummaryCard summary={summary} onRetry={practiceAgain} />}
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
            ) : reveal && !reveal.has_solution ? (
              <p className="text-sm">There is no reference solution for this problem in this language.</p>
            ) : (
              <p className="text-sm">
                {reveal?.requirement ?? "Submit your code and complete evaluation to unlock the solution."}{" "}
                Test runs, unavailable runtimes and service errors do not unlock it.
              </p>
            )}
          </section>
        </div>
        <aside className="practice-side" aria-label="Mentor and progress">
          <MentorPanel
            problemId={problemId}
            language={language}
            currentCode={code}
            provider={provider}
            requestHint={requestHint}
            disabled={busy}
            onStepBack={(target) => {
              window.location.href =
                target.kind === "problem"
                  ? `/practice?problem=${encodeURIComponent(target.id)}`
                  : "/track/dsa?mode=browse";
            }}
          />
          {progress && <div className="practice-chrome mt-4"><ProgressPanel progress={progress} /></div>}
          {serverWorkspace && (
            <div className="practice-chrome mt-4">
              <CheckpointsPanel
                checkpoints={checkpoints}
                templates={templates}
                template={template}
                disabled={busy}
                onCreate={saveCheckpoint}
                onRestore={restore}
                onDelete={removeCheckpoint}
                onReset={reset}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
