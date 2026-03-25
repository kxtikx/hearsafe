"use client"

import { useEffect, useState } from "react"
import { WaveBackground } from "@/components/common/Wave-background"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

// ─── Types ────────────────────────────────────────────────────────────────────
type WHOGrade = {
  grade: number
  label: string
  colorClass: string
  borderClass: string
  bgClass: string
}

type RiskInfo = {
  label: string
  colorClass: string
  bgClass: string
  borderClass: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getWHOGrade = (db: number): WHOGrade => {
  const n = parseFloat(String(db))
  if (n <= 25) return { grade: 0, label: "Normal", colorClass: "text-green-600", bgClass: "bg-green-500/10", borderClass: "border-green-500/20" }
  if (n <= 40) return { grade: 1, label: "Mild Loss", colorClass: "text-yellow-600", bgClass: "bg-yellow-500/10", borderClass: "border-yellow-500/20" }
  if (n <= 60) return { grade: 2, label: "Moderate Loss", colorClass: "text-orange-600", bgClass: "bg-orange-500/10", borderClass: "border-orange-500/20" }
  if (n <= 80) return { grade: 3, label: "Severe Loss", colorClass: "text-red-600", bgClass: "bg-red-500/10", borderClass: "border-red-500/30" }
  return { grade: 4, label: "Profound Loss", colorClass: "text-red-800", bgClass: "bg-red-900/20", borderClass: "border-red-800/40" }
}

const RISK_MAP: Record<string, RiskInfo> = {
  GREEN: { label: "Low Risk", colorClass: "text-green-600", bgClass: "bg-green-500/10", borderClass: "border-green-500/20" },
  YELLOW: { label: "Moderate Risk", colorClass: "text-yellow-600", bgClass: "bg-yellow-500/10", borderClass: "border-yellow-500/20" },
  ORANGE: { label: "Elevated Risk", colorClass: "text-orange-600", bgClass: "bg-orange-500/10", borderClass: "border-orange-500/20" },
  RED: { label: "High Risk", colorClass: "text-red-600", bgClass: "bg-red-500/10", borderClass: "border-red-500/30" },
}

const RECOMMENDATIONS: Record<string, Record<string, string[]>> = {
  GREEN: {
    young: [ // 18-35
      "Your hearing is excellent for your age — keep protecting it now while it matters most.",
      "Follow the 60/60 rule: max 60% volume for no more than 60 minutes at a time.",
      "Use earplugs at concerts, clubs or any venue above 85 dB.",
      "Retest every 12 months to track your baseline over time.",
      "Cardiovascular fitness is directly linked to hearing health — stay active.",
    ],
    middle: [ // 36-55
      "Your hearing is within normal limits for your age — well done.",
      "Age-related changes begin in this decade — annual retesting is recommended.",
      "Limit headphone use to under 1 hour daily at moderate volume.",
      "Get a professional audiogram as a baseline reference for future comparison.",
      "Avoid aspirin overuse — ototoxic medications can accelerate hearing loss.",
    ],
    senior: [ // 56+
      "Your hearing is normal for your age group after age correction — great result.",
      "Some high-frequency loss is expected and normal at your age (presbycusis).",
      "Retest every 6 months to monitor any progression.",
      "In noisy environments, position yourself facing speakers to aid comprehension.",
      "Discuss a full clinical audiogram with your GP at your next checkup.",
    ],
  },
  YELLOW: {
    young: [
      "Mild changes detected early — this is a warning sign at your age.",
      "Reduce headphone usage significantly — your hearing should be perfect at this age.",
      "Avoid all recreational noise exposure without certified hearing protection (NRR 25+).",
      "Schedule a professional audiogram within the next 2 months.",
      "Check for earwax buildup — it can artificially elevate thresholds.",
    ],
    middle: [
      "Mild loss detected — early intervention now prevents moderate loss later.",
      "Schedule an audiologist appointment within 3 months for a full evaluation.",
      "Reduce daily noise exposure and use hearing protection consistently.",
      "Monitor blood pressure — hypertension is a known risk factor for hearing loss.",
      "Retest quarterly using HearSafe to track any changes.",
    ],
    senior: [
      "Mild loss is common at your age — but monitoring is important.",
      "Consider a hearing aid assessment — even mild aids significantly improve quality of life.",
      "Use captioned calls and subtitles to reduce listening fatigue.",
      "Inform family members so they can support clearer communication.",
      "Schedule an ENT visit within the next 2 months.",
    ],
  },
  ORANGE: {
    young: [
      "Moderate hearing loss at your age is serious — immediate action is needed.",
      "This level of loss in a young person suggests noise-induced or medical causes.",
      "See an ENT specialist urgently — do not delay.",
      "Stop all recreational loud noise exposure immediately.",
      "Request a full audiological workup including bone conduction testing.",
    ],
    middle: [
      "Moderate hearing loss detected — professional evaluation is strongly advised.",
      "Schedule an ENT or audiologist appointment as soon as possible.",
      "Discuss hearing aid options — modern devices are discreet and highly effective.",
      "Avoid all loud environments without proper hearing protection.",
      "Consider communication strategies: face-to-face conversations, captioned calls.",
    ],
    senior: [
      "Moderate loss beyond expected age-related changes — further evaluation needed.",
      "A hearing aid is likely to significantly improve your daily quality of life.",
      "Visit an audiologist for a fitting consultation — modern aids are very discreet.",
      "Inform your GP — some causes of hearing loss in this age group are treatable.",
      "Avoid background noise situations — restaurants, crowded spaces — where possible.",
    ],
  },
  RED: {
    young: [
      "Significant hearing loss at your age requires urgent medical attention.",
      "This is not normal — possible causes include noise trauma, autoimmune, or genetic factors.",
      "Visit an ENT specialist immediately — do not wait.",
      "A full clinical workup including imaging (MRI) may be needed.",
      "Hearing aids or cochlear implant evaluation may be discussed by your specialist.",
    ],
    middle: [
      "Significant hearing loss detected — immediate consultation is essential.",
      "Visit an ENT specialist or audiologist urgently.",
      "A full clinical evaluation including bone conduction testing is recommended.",
      "Hearing aids are strongly recommended — discuss options with your specialist.",
      "Discuss potential medical or surgical options at your appointment.",
    ],
    senior: [
      "Significant loss beyond age-related norms — urgent specialist review needed.",
      "Hearing aids or assistive listening devices are strongly recommended.",
      "A cochlear implant evaluation may be appropriate — discuss with your ENT.",
      "Social isolation from hearing loss is a major risk factor for dementia — act now.",
      "Discuss all medication with your GP — some drugs are ototoxic and worsen loss.",
    ],
  },
}

const getAgeGroup = (age: number) => {
  if (age <= 35) return "young"
  if (age <= 55) return "middle"
  return "senior"
}

const AGE_GROUP_LABEL: Record<string, string> = {
  young: "18–35 yrs",
  middle: "36–55 yrs",
  senior: "56+ yrs",
}

const FREQ_LABELS = ["250", "500", "1k", "2k", "3k", "4k", "6k", "8k"]
const FREQUENCIES = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000]

// ─── Audiogram SVG ────────────────────────────────────────────────────────────
function Audiogram({
  leftThresholds,
  rightThresholds,
}: {
  leftThresholds: number[]
  rightThresholds: number[]
}) {
  const W = 600, H = 340
  const PAD = { top: 40, right: 32, bottom: 52, left: 64 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  // ISO 8253: dB HL axis runs -10 to 120, top to bottom
  const DB_MIN = -10, DB_MAX = 120
  const gridDBs = [-10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]

  // Log frequency scale
  const logFreqs = FREQUENCIES.map(f => Math.log2(f))
  const logMin = logFreqs[0]
  const logMax = logFreqs[logFreqs.length - 1]
  const xOf = (i: number) =>
    PAD.left + ((logFreqs[i] - logMin) / (logMax - logMin)) * plotW
  const yOf = (db: number) =>
    PAD.top + ((db - DB_MIN) / (DB_MAX - DB_MIN)) * plotH

  const makePath = (pts: number[]) =>
    pts
      .map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`)
      .join(" ")

  // ISO 8253 severity zone colors
  const zones = [
    { from: -10, to: 25, color: "rgb(34,197,94)", opacity: 0.07, label: "Normal" },
    { from: 25, to: 40, color: "rgb(234,179,8)", opacity: 0.10, label: "Mild" },
    { from: 40, to: 60, color: "rgb(249,115,22)", opacity: 0.10, label: "Moderate" },
    { from: 60, to: 80, color: "rgb(239,68,68)", opacity: 0.10, label: "Severe" },
    { from: 80, to: 120, color: "rgb(127,29,29)", opacity: 0.10, label: "Profound" },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto font-mono">

      {/* ── Severity zone bands ── */}
      {zones.map(z => (
        <rect
          key={z.label}
          x={PAD.left} y={yOf(z.from)}
          width={plotW} height={yOf(z.to) - yOf(z.from)}
          fill={z.color} fillOpacity={z.opacity}
        />
      ))}

      {/* ── Zone labels on right side ── */}
      {zones.map(z => (
        <text
          key={z.label + "lbl"}
          x={W - PAD.right + 4}
          y={yOf((z.from + z.to) / 2) + 4}
          fill="currentColor" fillOpacity="0.35"
          fontSize="8" textAnchor="start"
        >{z.label}</text>
      ))}

      {/* ── Horizontal grid lines (every 10 dB per ISO 8253) ── */}
      {gridDBs.map(db => (
        <g key={db}>
          <line
            x1={PAD.left} y1={yOf(db)}
            x2={W - PAD.right} y2={yOf(db)}
            stroke="currentColor"
            strokeOpacity={db === 0 ? 0.25 : 0.08}
            strokeWidth={db === 0 ? 1.5 : 1}
            strokeDasharray={db % 20 === 0 ? "0" : "3 4"}
          />
          {/* dB label every 20 dB */}
          {db % 20 === 0 && (
            <text
              x={PAD.left - 8} y={yOf(db) + 4}
              textAnchor="end"
              fill="currentColor" fillOpacity="0.5"
              fontSize="10"
            >{db}</text>
          )}
        </g>
      ))}

      {/* ── Vertical grid lines + freq labels ── */}
      {FREQUENCIES.map((freq, i) => (
        <g key={freq}>
          <line
            x1={xOf(i)} y1={PAD.top}
            x2={xOf(i)} y2={H - PAD.bottom}
            stroke="currentColor"
            strokeOpacity={freq === 1000 || freq === 2000 ? 0.20 : 0.08}
            strokeWidth={freq === 1000 ? 1.5 : 1}
          />
          {/* Frequency label */}
          <text
            x={xOf(i)} y={H - PAD.bottom + 16}
            textAnchor="middle"
            fill="currentColor" fillOpacity="0.6"
            fontSize="10" fontWeight={freq === 1000 ? "bold" : "normal"}
          >
            {freq >= 1000 ? `${freq / 1000}k` : freq}
          </text>
          {/* Hz unit under first label only */}
          {i === 0 && (
            <text x={xOf(i)} y={H - PAD.bottom + 28}
              textAnchor="middle" fill="currentColor"
              fillOpacity="0.35" fontSize="8">Hz</text>
          )}
        </g>
      ))}

      {/* ── Outer border box (ISO 8253 style) ── */}
      <rect
        x={PAD.left} y={PAD.top}
        width={plotW} height={plotH}
        fill="none"
        stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5"
      />

      {/* ── Axis titles ── */}
      <text
        x={W / 2} y={H - 4}
        textAnchor="middle"
        fill="currentColor" fillOpacity="0.45"
        fontSize="10" fontWeight="600"
      >Frequency (Hz)</text>
      <text
        x={12} y={PAD.top + plotH / 2}
        textAnchor="middle"
        fill="currentColor" fillOpacity="0.45"
        fontSize="10" fontWeight="600"
        transform={`rotate(-90, 12, ${PAD.top + plotH / 2})`}
      >Hearing Level (dB HL)</text>

      {/* ── Title ── */}
      <text
        x={W / 2} y={18}
        textAnchor="middle"
        fill="currentColor" fillOpacity="0.6"
        fontSize="11" fontWeight="700" letterSpacing="1"
      >PURE TONE AUDIOGRAM — ISO 8253</text>

      {/* ── Right ear: RED line + × symbol (ISO standard) ── */}
      {rightThresholds.length >= 2 && (
        <path
          d={makePath(rightThresholds)}
          fill="none" stroke="rgb(239,68,68)" strokeWidth="2"
          strokeDasharray="6 3" strokeLinecap="round"
          opacity="0.9"
        />
      )}
      {rightThresholds.map((v, i) => (
        <text
          key={i}
          x={xOf(i)} y={yOf(v) + 5}
          textAnchor="middle"
          fill="rgb(239,68,68)"
          fontSize="14" fontWeight="bold"
        >×</text>
      ))}

      {/* ── Left ear: BLUE line + ○ symbol (ISO standard) ── */}
      {leftThresholds.length >= 2 && (
        <path
          d={makePath(leftThresholds)}
          fill="none" stroke="rgb(59,130,246)" strokeWidth="2"
          strokeLinecap="round" opacity="0.9"
        />
      )}
      {leftThresholds.map((v, i) => (
        <circle
          key={i}
          cx={xOf(i)} cy={yOf(v)} r={6}
          fill="white" fillOpacity="0.9"
          stroke="rgb(59,130,246)" strokeWidth="2.5"
        />
      ))}

    </svg>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ResultsPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const stored = localStorage.getItem("analysisResult")
    const qa = localStorage.getItem("qaData")
    if (stored) {
      const parsed = JSON.parse(stored)
      const qaData = qa ? JSON.parse(qa) : {}
      setData({ ...parsed, age: qaData.age ?? 30 })
    }
  }, [])

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <WaveBackground />
        <p className="text-muted-foreground relative z-10">Loading results…</p>
      </div>
    )
  }

  // ─── Derived values ────────────────────────────────────────────────────────
  const leftT = (data.left_thresholds as number[]) || []
  const rightT = (data.right_thresholds as number[]) || []

  const ptaLeft = parseFloat(data.pta_left ?? String([1, 2, 3].reduce((s, i) => s + (leftT[i] ?? 0), 0) / 3))
  const ptaRight = parseFloat(data.pta_right ?? String([1, 2, 3].reduce((s, i) => s + (rightT[i] ?? 0), 0) / 3))

  const whoLeft = (data.who_grade_left as WHOGrade) || getWHOGrade(ptaLeft)
  const whoRight = (data.who_grade_right as WHOGrade) || getWHOGrade(ptaRight)

  const riskLevel = (data.risk || data.risk_level || "GREEN") as string
  const risk = RISK_MAP[riskLevel] || RISK_MAP.GREEN

  const score = data.overall_score ?? Math.max(0, Math.round(100 - (ptaLeft + ptaRight) / 2))
  const testDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })

  const showSpecialist = riskLevel === "ORANGE" || riskLevel === "RED" || whoLeft.grade >= 2 || whoRight.grade >= 2

  return (
    <div className="min-h-screen">
      <WaveBackground />
      <div className="relative z-10 max-w-4xl mx-auto p-6">

        {/* ── Header ── */}
        <div className="text-center mb-10 mt-10">
          <h1 className="text-2xl md:text-4xl font-bold mb-2">Your Audiometry Report</h1>
          <p className="text-muted-foreground">
            Pure Tone Audiometry (PTA) · Generated {testDate}
          </p>
        </div>

        {/* ── Score + WHO Cards ── */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {/* Hearing Score */}
          <Card className="p-6 text-center flex flex-col items-center justify-center">
            <div className="relative w-28 h-28 mb-3">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40"
                  fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="10" />
                <circle cx="50" cy="50" r="40"
                  fill="none"
                  stroke={score >= 75 ? "rgb(34,197,94)" : score >= 50 ? "rgb(234,179,8)" : score >= 25 ? "rgb(249,115,22)" : "rgb(239,68,68)"}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 251.2} 251.2`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{score}</span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
            </div>
            <p className="text-sm font-semibold text-muted-foreground">Hearing Score</p>
          </Card>

          {/* Left Ear WHO */}
          <Card className={`p-6 border ${whoLeft.borderClass} ${whoLeft.bgClass}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-blue-500">hearing</span>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Left Ear · PTA
              </p>
            </div>
            <p className={`text-4xl font-bold ${whoLeft.colorClass} mb-1`}>
              {ptaLeft.toFixed(0)} <span className="text-xl font-normal">dB</span>
            </p>
            <p className={`font-semibold ${whoLeft.colorClass}`}>{whoLeft.label}</p>
            <p className="text-xs text-muted-foreground mt-1">WHO Grade {whoLeft.grade}</p>
          </Card>

          {/* Right Ear WHO */}
          <Card className={`p-6 border ${whoRight.borderClass} ${whoRight.bgClass}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-purple-500">hearing</span>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Right Ear · PTA
              </p>
            </div>
            <p className={`text-4xl font-bold ${whoRight.colorClass} mb-1`}>
              {ptaRight.toFixed(0)} <span className="text-xl font-normal">dB</span>
            </p>
            <p className={`font-semibold ${whoRight.colorClass}`}>{whoRight.label}</p>
            <p className="text-xs text-muted-foreground mt-1">WHO Grade {whoRight.grade}</p>
          </Card>
        </div>

        {/* ── Audiogram ── */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <h2 className="text-2xl font-semibold">Pure Tone Audiogram</h2>
            <div className="flex gap-4">
              <span className="flex items-center gap-2 text-sm text-blue-500">
                <svg width="32" height="14">
                  <line x1="0" y1="7" x2="32" y2="7" stroke="rgb(59,130,246)" strokeWidth="2" />
                  <circle cx="16" cy="7" r="5" fill="white" stroke="rgb(59,130,246)" strokeWidth="2.5" />
                </svg>
                Left Ear (○)
              </span>
              <span className="flex items-center gap-2 text-sm text-red-500">
                <svg width="32" height="14">
                  <line x1="0" y1="7" x2="32" y2="7" stroke="rgb(239,68,68)" strokeWidth="2" strokeDasharray="5 3" />
                  <text x="16" y="12" textAnchor="middle" fill="rgb(239,68,68)" fontSize="14" fontWeight="bold">×</text>
                </svg>
                Right Ear (×)
              </span>
            </div>
          </div>
          <Audiogram leftThresholds={leftT} rightThresholds={rightT} />
        </Card>
        {/* Presbycusis correction note */}
        {data.age_correction_applied && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <span className="material-symbols-outlined text-blue-500 text-base flex-shrink-0">info</span>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Age Correction Applied (ISO 7029):</strong> Expected age-related hearing
              loss has been subtracted from your thresholds before scoring. The audiogram
              shows your <em>raw</em> measurements. Your risk score reflects hearing loss
              beyond what is normal for your age.
            </p>
          </div>
        )}

        {/* ── Threshold Table ── */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Hearing Thresholds by Frequency</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-semibold text-xs uppercase tracking-wider">Ear</th>
                  {FREQ_LABELS.map(f => (
                    <th key={f} className="text-center py-2 px-3 text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                      {f} Hz
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([["Left", leftT, "text-blue-500"], ["Right", rightT, "text-purple-500"]] as const).map(([ear, vals, earColor]) => (
                  <tr key={ear} className="border-b border-border/50">
                    <td className={`py-3 px-3 font-semibold ${earColor}`}>{ear}</td>
                    {FREQ_LABELS.map((_, i) => {
                      const v = (vals as number[])[i]
                      const g = v != null ? getWHOGrade(v) : null
                      return (
                        <td key={i} className={`py-3 px-3 text-center font-medium ${g ? g.colorClass : "text-muted-foreground"}`}>
                          {v != null ? `${v} dB` : "—"}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── AI Clinical Metrics (if from backend) ── */}
        {(data.cli != null || data.hf_shift_index != null) && (
          <Card className="p-6 mb-6 border border-primary/20 bg-primary/5">
            <h2 className="text-2xl font-semibold mb-4">AI Clinical Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ["Risk Level", data.risk || riskLevel, risk.colorClass],
                ["Cochlear Load Index", data.cli, "text-blue-500"],
                ["High Frequency Shift", data.hf_shift_index, "text-purple-500"],
                ["EHFA Mean", data.ehfa_mean, "text-primary"],
              ].filter(([, v]) => v != null).map(([label, val, color]) => (
                <div key={String(label)} className="p-4 rounded-lg bg-background/60 border border-border">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                    {label}
                  </p>
                  <p className={`text-xl font-bold ${color}`}>{val}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── WHO Reference Scale ── */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">WHO Hearing Classification</h2>
          <div className="space-y-2">
            {[
              { grade: 0, range: "0–25 dB", label: "Normal", colorClass: "text-green-600", bgClass: "bg-green-500/10", borderClass: "border-green-500/20" },
              { grade: 1, range: "26–40 dB", label: "Mild Loss", colorClass: "text-yellow-600", bgClass: "bg-yellow-500/10", borderClass: "border-yellow-500/20" },
              { grade: 2, range: "41–60 dB", label: "Moderate Loss", colorClass: "text-orange-600", bgClass: "bg-orange-500/10", borderClass: "border-orange-500/20" },
              { grade: 3, range: "61–80 dB", label: "Severe Loss", colorClass: "text-red-600", bgClass: "bg-red-500/10", borderClass: "border-red-500/30" },
              { grade: 4, range: "81+ dB", label: "Profound Loss", colorClass: "text-red-800", bgClass: "bg-red-900/20", borderClass: "border-red-800/40" },
            ].map(row => {
              const isLeft = whoLeft.grade === row.grade
              const isRight = whoRight.grade === row.grade
              const active = isLeft || isRight
              return (
                <div
                  key={row.grade}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${active ? `${row.bgClass} ${row.borderClass}` : "border-transparent"
                    }`}
                >
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${row.colorClass.replace("text-", "bg-")}`} />
                  <span className={`font-bold text-sm ${row.colorClass} w-8`}>G{row.grade}</span>
                  <span className="text-muted-foreground text-sm w-24">{row.range}</span>
                  <span className="text-sm flex-1">{row.label}</span>
                  <div className="flex gap-2">
                    {isLeft && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 font-medium">L</span>}
                    {isRight && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20 font-medium">R</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* ── Recommendations ── */}
        <Card className={`p-6 mb-6 border ${risk.borderClass} ${risk.bgClass}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-background/60`}>
              <span className={`material-symbols-outlined ${risk.colorClass}`}>
                {riskLevel === "GREEN" ? "check_circle" : riskLevel === "RED" ? "emergency" : "warning"}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{risk.label}</h2>
              <p className="text-sm text-muted-foreground">Personalised Recommendations</p>
            </div>
          </div>
          {(() => {
            const userAge = data.age ?? 30
            const ageGroup = getAgeGroup(userAge)
            const recs = RECOMMENDATIONS[riskLevel]?.[ageGroup] ?? RECOMMENDATIONS[riskLevel]?.middle ?? []
            return (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  Recommendations tailored for age group:{" "}
                  <span className="font-semibold">{AGE_GROUP_LABEL[ageGroup]}</span>
                </p>
                <ul className="space-y-3">
                  {recs.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
                      <span className="material-symbols-outlined text-base mt-0.5 text-muted-foreground flex-shrink-0">
                        arrow_right
                      </span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </>
            )
          })()}
        </Card>

        {/* ── Find Specialist ── */}
        {showSpecialist && (
          <Card className="p-6 mb-6 border-2 border-orange-200 bg-orange-500/5">
            <div className="flex items-start gap-3 mb-4">
              <span className="material-symbols-outlined text-orange-500 flex-shrink-0">local_hospital</span>
              <div>
                <h2 className="text-xl font-semibold mb-1">Consult a Specialist</h2>
                <p className="text-sm text-muted-foreground">
                  Based on your results, we recommend consulting a qualified audiologist or ENT specialist.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => window.open("https://www.google.com/maps/search/audiologist+near+me", "_blank")}
              >
                <span className="material-symbols-outlined text-base mr-2">search</span>
                Find Audiologist
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open("https://www.google.com/maps/search/ENT+doctor+near+me", "_blank")}
              >
                <span className="material-symbols-outlined text-base mr-2">local_hospital</span>
                Find ENT Doctor
              </Button>
            </div>
          </Card>
        )}

        {/* ── Medical Disclaimer ── */}
        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg mb-8 flex gap-3">
          <span className="material-symbols-outlined text-orange-500 flex-shrink-0">info</span>
          <p className="text-sm text-orange-700">
            <strong>Medical Disclaimer:</strong> This is a screening tool only and does not constitute a clinical
            diagnosis. Please consult a licensed audiologist or ENT specialist for a comprehensive evaluation.
          </p>
        </div>

        {/* ── Actions ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <Button className="w-full" onClick={() => window.print()}>
            <span className="material-symbols-outlined text-base mr-2">download</span>
            Download PDF Report
          </Button>
          <Button variant="outline" className="w-full" onClick={() => router.push("/test")}>
            <span className="material-symbols-outlined text-base mr-2">refresh</span>
            Retake Test
          </Button>
        </div>

      </div>
    </div>
  )
}