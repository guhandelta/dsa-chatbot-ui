// Socratic mentor. The learner must state their reasoning before a hint is
// given — the input is deliberately gated on it, because the whole point is
// that the mentor responds to THEIR thinking, not to the problem in general.
import { useEffect, useRef, useState } from "react";
import { askMentor, fetchEntitlement, getApiErrorMessage } from "../lib/api";
import { fetchNextHint } from "../lib/studyApi";
import { useAuth } from "../lib/auth";
import type { Entitlement, MentorResponse, Provider } from "../types";
import { isDraftText, useLearningDraft, useLearningPauseGuard } from "../lib/learningSupport";

interface Props {
  problemId: string;
  language: string;
  currentCode?: string;
  provider?: Provider;
  disabled?: boolean;
  requestHint?: (reasoning: string, maxCost?: number) => Promise<MentorResponse>;
  onStepBack?: (target: { id: string; kind: "concept" | "problem" }) => void;
}

interface Turn {
  reasoning: string;
  response: MentorResponse;
}

export function MentorPanel(props: Props) {
  return <MentorContext key={JSON.stringify([props.problemId, props.language])} {...props} />;
}

function MentorContext({
  problemId,
  language,
  currentCode = "",
  provider = "openai",
  onStepBack,
  requestHint,
  disabled = false,
}: Props) {
  const { setBalance } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [reasoning, setReasoning] = useLearningDraft(`mentor:${language}:${problemId}`, "", isDraftText);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  useLearningPauseGuard(loading);
  const [error, setError] = useState<string | null>(null);
  const [nextCost, setNextCost] = useState<number | null>(null);

  const active = useRef(false);
  const priceRevision = useRef(0);
  const asking = useRef(false);

  const refreshPrice = async () => {
    const revision = ++priceRevision.current;
    setNextCost(null);
    try {
      const price = await fetchNextHint(problemId, language);
      if (active.current && revision === priceRevision.current) setNextCost(price.cost);
    } catch {
      if (active.current && revision === priceRevision.current) setNextCost(null);
    }
  };

  useEffect(() => {
    active.current = true;
    void refreshPrice();
    let current = true;
    fetchEntitlement(language)
      .then((value) => { if (current) setEntitlement(value); })
      .catch(() => { if (current) setEntitlement(null); });
    return () => {
      current = false;
      active.current = false;
      ++priceRevision.current;
    };
  }, [problemId, language]);

  const ask = async () => {
    const text = reasoning.trim();
    if (!text || asking.current || disabled) return;
    asking.current = true;
    ++priceRevision.current;
    const maxCost = nextCost ?? 0;
    setLoading(true);
    setError(null);
    try {
      const response = requestHint
        ? await requestHint(text, maxCost)
        : await askMentor({
            problemId,
            language,
            reasoning: text,
            currentCode,
            provider,
            maxHintCost: maxCost,
          });
      if (!active.current) return;
      setTurns((prev) => [...prev, { reasoning: text, response }]);
      setBalance(response.peppercorns_remaining);
      setNextCost(response.next_hint_cost ?? null);
      setReasoning("");
    } catch (err) {
      if (!active.current) return;
      setError(getApiErrorMessage(err));
      if ((err as { response?: { status?: number } })?.response?.status === 409) {
        await refreshPrice();
      }
    } finally {
      asking.current = false;
      if (active.current) setLoading(false);
    }
  };

  if (entitlement && !entitlement.entitled) {
    return (
      <section className="island-shell rounded-2xl p-5">
        <p className="island-kicker mb-2">Mentor</p>
        <h3 className="mb-2 text-base font-bold text-[var(--sea-ink)]">
          Socratic guidance for {language}
        </h3>
        <p className="mb-3 text-sm text-[var(--sea-ink-soft)]">
          {entitlement.reason}
        </p>
        <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
          Code review, chat, and practice stay fully available without this.
        </p>
      </section>
    );
  }

  const latest = turns[turns.length - 1]?.response;

  return (
    <section className="island-shell rounded-2xl p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="island-kicker mb-1">Mentor</p>
          <h3 className="m-0 text-base font-bold text-[var(--sea-ink)]">
            Think it through
          </h3>
        </div>
        {latest && (
          <span className="tier-chip">
            Hint {latest.hint_tier}/4 · {latest.tier_label}
          </span>
        )}
      </div>

      <p className="mb-3 text-sm text-[var(--sea-ink-soft)]">
        Tell me what you&apos;re thinking and I&apos;ll ask the next question. I
        won&apos;t give you the solution — working it out yourself is the point.
      </p>

      {turns.length > 0 && (
        <div className="mentor-thread mb-3">
          {turns.map((turn, i) => (
            <div key={i} className="mentor-turn">
              <div className="mentor-you">
                <span className="mentor-label">You</span>
                <p>{turn.reasoning}</p>
              </div>
              <div className="mentor-reply">
                <span className="mentor-label">Mentor</span>
                <p>{turn.response.reply}</p>
                {turn.response.recalled_moment && (
                  <div className="recall-card">
                    <span className="recall-label">
                      You&apos;ve reasoned like this before
                    </span>
                    <p>{turn.response.recalled_moment}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {latest?.step_back_offer && (
        <div className="step-back">
          <p className="m-0 mb-2 text-sm">{latest.step_back_offer.message}</p>
          <div className="flex flex-wrap gap-2">
            {latest.step_back_offer.easier_problem && (
              <button
                type="button"
                className="mini-btn"
                onClick={() =>
                  onStepBack?.({
                    id: latest.step_back_offer!.easier_problem!.id,
                    kind: "problem",
                  })
                }
              >
                Try {latest.step_back_offer.easier_problem.title}
              </button>
            )}
            {latest.step_back_offer.concept && (
              <button
                type="button"
                className="mini-btn"
                onClick={() =>
                  onStepBack?.({
                    id: latest.step_back_offer!.concept!.id,
                    kind: "concept",
                  })
                }
              >
                Review the {latest.step_back_offer.algorithm} concept
              </button>
            )}
          </div>
        </div>
      )}

      {error && <div className="error-banner mb-3">{error}</div>}

      <label className="selector block">
        <span className="selector-label">
          {turns.length === 0
            ? "What is your current approach?"
            : "What are you thinking now?"}
        </span>
        <textarea
          className="train-textarea"
          rows={3}
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          placeholder="e.g. I'm looping over every pair, but that feels too slow — I think I need to remember what I've seen…"
          disabled={loading}
        />
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={ask}
          disabled={disabled || loading || !reasoning.trim()}
          className="primary-btn"
        >
          {loading
            ? "Thinking with you…"
            : turns.length
              ? "I need another nudge"
              : "Ask"}
        </button>
        <span className="cost-note m-0">
          {nextCost === null
            ? "Price unavailable. Asking is capped at 0 peppercorns; a changed price will be refreshed."
            : nextCost === 0
              ? "This nudge is free (hints 1–2 on every problem are free)."
              : `This nudge costs ${nextCost} peppercorns (hints 3–4 are charged).`}
        </span>
      </div>
    </section>
  );
}
