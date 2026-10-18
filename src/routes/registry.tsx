import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState, useMemo } from "react"
import {
  Layers,
  Cpu,
  RefreshCw,
  Search,
  CheckCircle2,
  Sparkles,
  Code2,
  Globe,
  Server,
  BookOpen
} from "lucide-react"
import {
  fetchTrainingRegistry,
  type TrainingRegistryResponse,
  type TrainingRegistryTechnology,
  type TrainingEvent
} from "../lib/api"

import { useAuth } from "../lib/auth"
import { canAccessTeaching, requireTeachingAccess } from "../lib/routeAccess"

export const Route = createFileRoute("/registry")({
  beforeLoad: requireTeachingAccess,
  component: TrainingRegistryPage,
})

const CATEGORY_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  all: { label: "All Technologies", icon: Layers, color: "var(--lagoon)" },
  web_frontend: { label: "Web & Frontend", icon: Globe, color: "#10b981" },
  backend_frameworks: { label: "Backend Frameworks", icon: Server, color: "#06b6d4" },
  core_languages: { label: "Core Languages", icon: Code2, color: "#3b82f6" },
  embedded_systems: { label: "Embedded & Hardware", icon: Cpu, color: "#f59e0b" },
  algorithms_and_dsa: { label: "Algorithms & DSA", icon: BookOpen, color: "#8b5cf6" },
}

export function TrainingRegistryPage() {
  const { user, initializing } = useAuth()
  const canReadRegistry = canAccessTeaching(user)
  const [data, setData] = useState<TrainingRegistryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")

  const loadData = async (isManual = false) => {
    if (!canReadRegistry) return
    if (isManual) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetchTrainingRegistry()
      setData(res)
    } catch (err: any) {
      setError(err?.message || "Failed to load training registry")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!initializing && canReadRegistry) void loadData()
  }, [user?.id, canReadRegistry, initializing])

  const filteredTechnologies = useMemo(() => {
    if (!data?.technologies) return []
    return data.technologies.filter((tech: TrainingRegistryTechnology) => {
      const matchesCategory =
        selectedCategory === "all" || tech.category === selectedCategory
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !query ||
        tech.display_name.toLowerCase().includes(query) ||
        tech.id.toLowerCase().includes(query) ||
        tech.category.toLowerCase().includes(query)
      return matchesCategory && matchesSearch
    })
  }, [data, selectedCategory, searchQuery])

  if (initializing) return <main className="page-wrap py-8"><p role="status">Checking registry access…</p></main>
  if (!canReadRegistry) return <main className="page-wrap py-8"><h1>Staff access required</h1><p>The knowledge registry is available to admins and instructors.</p></main>

  return (
    <main className="page-wrap px-4 py-8 sm:py-12">
      {/* Top Banner */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold text-[var(--kicker)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--lagoon)]" />
            Live Knowledge Registry & Audit Board
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-3xl">
            Trained Technologies & Knowledge Board
          </h1>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            Verified, real-time inventory of all programming languages, web curricula,
            and frameworks trained and retrievable by the RAG mentor.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] shadow-sm transition hover:bg-[var(--surface)] hover:-translate-y-0.5 disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-[var(--lagoon)]" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh Board"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Metrics Ribbon */}
      {data?.summary && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm backdrop-blur-md">
            <div className="text-xs font-medium text-[var(--sea-ink-soft)]">Trained Technologies</div>
            <div className="mt-1 text-2xl font-extrabold text-[var(--sea-ink)]">
              {data.summary.total_technologies_trained}
            </div>
            <div className="mt-1 text-xs text-[var(--lagoon-deep)]">Languages & Frameworks</div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm backdrop-blur-md">
            <div className="text-xs font-medium text-[var(--sea-ink-soft)]">Total Knowledge Records</div>
            <div className="mt-1 text-2xl font-extrabold text-[var(--sea-ink)]">
              {data.summary.total_knowledge_records.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Across All Catalogs</div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm backdrop-blur-md">
            <div className="text-xs font-medium text-[var(--sea-ink-soft)]">Retrievable Chunks</div>
            <div className="mt-1 text-2xl font-extrabold text-[var(--sea-ink)]">
              {data.summary.total_retrievable_chunks.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-[var(--lagoon-deep)]">Safe for RAG Answers</div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm backdrop-blur-md">
            <div className="text-xs font-medium text-[var(--sea-ink-soft)]">Vector Store (ChromaDB)</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-[var(--sea-ink)]">
                {data.summary.vector_store.vector_count.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {data.summary.vector_store.status}
              </span>
            </div>
            <div className="mt-1 text-xs text-[var(--sea-ink-soft)]">
              Embedding: {data.summary.embedding_provider}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-col gap-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sea-ink-soft)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search technologies, e.g. HTML5, CSS, Django, Rust, Tailwind..."
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--sea-ink)] placeholder-[var(--sea-ink-soft)] shadow-sm outline-none transition focus:border-[var(--lagoon)] focus:ring-2 focus:ring-[var(--lagoon)]/20"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORY_LABELS).map(([key, config]) => {
            const count =
              key === "all"
                ? data?.technologies.length || 0
                : data?.categories?.[key] || 0
            const active = selectedCategory === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedCategory(key)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-[var(--sea-ink)] text-white shadow-sm"
                    : "border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] hover:bg-[var(--surface)]"
                }`}
              >
                <span>{config.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-[var(--line)] text-[var(--sea-ink-soft)]"
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Technologies Cards Grid */}
      {loading ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-12 text-center text-sm text-[var(--sea-ink-soft)]">
          <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-[var(--lagoon)]" />
          Loading knowledge registry board...
        </div>
      ) : filteredTechnologies.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-12 text-center text-sm text-[var(--sea-ink-soft)]">
          No technologies matched your search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTechnologies.map((tech) => (
            <div
              key={tech.id}
              className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2 py-0.5 text-[11px] font-mono font-semibold uppercase text-[var(--sea-ink-soft)]">
                    {tech.id}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Trained
                  </span>
                </div>

                <h3 className="mt-3 text-base font-bold text-[var(--sea-ink)]">
                  {tech.display_name}
                </h3>
                <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                  Category: {CATEGORY_LABELS[tech.category]?.label || tech.category}
                </p>
              </div>

              <div className="mt-5 border-t border-[var(--line)] pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--sea-ink-soft)]">Total Records</span>
                  <span className="font-bold text-[var(--sea-ink)]">
                    {tech.total_records.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="text-[var(--sea-ink-soft)]">Retrievable Chunks</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {tech.retrievable_records.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ingestion & Training Audit Log */}
      {data?.recent_training_events && data.recent_training_events.length > 0 && (
        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--sea-ink)]">
              Recent Training & Ingestion Audit Log
            </h2>
            <span className="text-xs text-[var(--sea-ink-soft)]">
              Append-only audit record
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink-soft)] font-semibold">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Technology / Scope</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3 text-right">Records Added</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] text-[var(--sea-ink)]">
                {data.recent_training_events.map((evt: TrainingEvent) => (
                  <tr key={evt.id} className="hover:bg-[var(--surface-strong)]/50 transition">
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--sea-ink-soft)]">
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {evt.technology.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--sea-ink-soft)]">
                      {evt.action}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {evt.record_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        {evt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}
