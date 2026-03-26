"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { auth } from "@/lib/firebase/client"
import { db } from "@/lib/firebase/client"
import { collection, addDoc, Timestamp } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { WaveBackground } from "@/components/common/Wave-background"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

// ─── Constants ────────────────────────────────────────────────────────────────
const FREQUENCIES = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000]
const FREQ_LABELS = ["250 Hz", "500 Hz", "1 kHz", "2 kHz", "3 kHz", "4 kHz", "6 kHz", "8 kHz"]
const EARS: ("left" | "right")[] = ["left", "right"]
const START_DB = 40
const MIN_DB = 0
const MAX_DB = 90
const STEP_DB = 5

// ─── WHO Grade ────────────────────────────────────────────────────────────────
type WHOGrade = {
  grade: number
  label: string
  colorClass: string
  bgClass: string
}

const getWHOGrade = (db: number): WHOGrade => {
  if (db <= 25) return { grade: 0, label: "Normal", colorClass: "text-green-600", bgClass: "bg-green-500/10 border-green-500/20" }
  if (db <= 40) return { grade: 1, label: "Mild Loss", colorClass: "text-yellow-600", bgClass: "bg-yellow-500/10 border-yellow-500/20" }
  if (db <= 60) return { grade: 2, label: "Moderate Loss", colorClass: "text-orange-600", bgClass: "bg-orange-500/10 border-orange-500/20" }
  if (db <= 80) return { grade: 3, label: "Severe Loss", colorClass: "text-red-600", bgClass: "bg-red-500/10 border-red-500/20" }
  return { grade: 4, label: "Profound Loss", colorClass: "text-red-800", bgClass: "bg-red-900/20 border-red-800/30" }
}

// Correct dB-to-gain: amplitude = 10^((dB - 90) / 20)
const dbToGain = (db: number): number => Math.pow(10, (db - 90) / 20)

// ─── Stages ───────────────────────────────────────────────────────────────────
type Stage = "calibration" | "testing" | "done"

type Thresholds = {
  left: number[]
  right: number[]
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HearingTestPage() {
  const router = useRouter()

  // Stage
  const [stage, setStage] = useState<Stage>("calibration")

  // Calibration state
  const [calDb, setCalDb] = useState(50)
  const [calibrationHeard, setCalibrationHeard] = useState<boolean | null>(null)
  const [calChecks, setCalChecks] = useState([false, false, false])

  // Test state
  const [currentEarIndex, setCurrentEarIndex] = useState(0)
  const [currentFreqIndex, setCurrentFreqIndex] = useState(0)
  const [currentDb, setCurrentDb] = useState(START_DB)
  const [toneHeard, setToneHeard] = useState<boolean | null>(null)
  const [yesCount, setYesCount] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [noFloor, setNoFloor] = useState<number>(MIN_DB)
  const [thresholds, setThresholds] = useState<Thresholds>({ left: [], right: [] })
  const [isPlaying, setIsPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
    })
    return () => unsubscribe()
  }, [])

  // Refs
  const audioCtxRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)

  const currentEar = EARS[currentEarIndex]
  const currentFreq = FREQUENCIES[currentFreqIndex]
  const totalSteps = EARS.length * FREQUENCIES.length
  const completedSteps = currentEarIndex * FREQUENCIES.length + currentFreqIndex

  // ─── Audio ──────────────────────────────────────────────────────────────────
  const stopTone = useCallback(() => {
    if (oscillatorRef.current) {
      try { oscillatorRef.current.stop() } catch (_) { }
      oscillatorRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const playTone = useCallback((freq: number, db: number, duration = 1500, ear: "left" | "right" = "left") => {
    stopTone()
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    audioCtxRef.current = ctx

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const gainValue = dbToGain(db)

    osc.type = "sine"
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + 0.05)
    gain.gain.setValueAtTime(gainValue, ctx.currentTime + duration / 1000 - 0.05)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration / 1000)

    const merger = ctx.createChannelMerger(2)
    const splitter = ctx.createChannelSplitter(1)

    gain.connect(splitter)

    if (ear === "left") {
      splitter.connect(merger, 0, 0) // left channel only
    } else {
      splitter.connect(merger, 0, 1) // right channel only
    }

    merger.connect(ctx.destination)

    osc.connect(gain)
    osc.start()
    oscillatorRef.current = osc
    setIsPlaying(true)

    setTimeout(stopTone, duration + 100)
  }, [stopTone])

  useEffect(() => () => stopTone(), [stopTone])

  useEffect(() => {
  // Keep Render backend alive
  const ping = setInterval(() => {
    fetch("https://hearsafe-backend.onrender.com/")
      .catch(() => {})
  }, 10 * 60 * 1000) // every 10 minutes
  return () => clearInterval(ping)
}, [])

  // ─── Calibration ────────────────────────────────────────────────────────────
  const toggleCheck = (i: number) => {
    setCalChecks(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  const allChecked = calChecks.every(Boolean)

  // ─── Test Logic (Hughson-Westlake) ───────────────────────────────────────────
  const handleResponse = (heard: boolean) => {
    setToneHeard(heard)
    const newYes = yesCount + (heard ? 1 : 0)
    const newAttempts = attempts + 1

    // 2 correct at this level → threshold confirmed
    if (heard && newYes >= 2) {
      recordThreshold(currentDb)
      return
    }

    if (!heard) {
      // Didn't hear → raise floor, increase 5 dB, reset yes count
      const newFloor = Math.max(noFloor, currentDb)
      setNoFloor(newFloor)
      setCurrentDb(prev => Math.min(MAX_DB, prev + 5))
      setYesCount(0)
      setAttempts(0)
    } else {
      // Heard → drop 10 dB but never go below (noFloor + 5)
      const safeMin = Math.max(MIN_DB, noFloor + 5)
      setCurrentDb(prev => Math.max(safeMin, prev - 10))
      setYesCount(newYes)
      setAttempts(newAttempts)
    }
    setToneHeard(null)
  }

  const handleManualNext = () => {
    const threshold = toneHeard ? currentDb : Math.min(MAX_DB, currentDb + 5)
    recordThreshold(threshold)
  }

  const recordThreshold = (db: number) => {
    const updated: Thresholds = {
      left: [...thresholds.left],
      right: [...thresholds.right],
    }
    updated[currentEar] = [...updated[currentEar], db]
    setThresholds(updated)

    // Reset per-frequency state
    setToneHeard(null)
    setYesCount(0)
    setAttempts(0)
    setNoFloor(MIN_DB)
    setCurrentDb(START_DB)

    if (currentFreqIndex < FREQUENCIES.length - 1) {
      setCurrentFreqIndex(prev => prev + 1)
    } else if (currentEarIndex < EARS.length - 1) {
      setCurrentEarIndex(prev => prev + 1)
      setCurrentFreqIndex(0)
    } else {
      submitResults(updated)
    }
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────
  const submitResults = async (finalThresholds: Thresholds) => {
    setLoading(true)
    setStage("done")

    // PTA = average of 500, 1000, 2000 Hz thresholds (indices 1, 2, 3)
    const ptaLeft = [1, 2, 3].reduce((s, i) => s + (finalThresholds.left[i] ?? 0), 0) / 3
    const ptaRight = [1, 2, 3].reduce((s, i) => s + (finalThresholds.right[i] ?? 0), 0) / 3

    const qaData = JSON.parse(localStorage.getItem("qaData") || "{}")
    let uid = localStorage.getItem("user_id")
    if (!uid) {
      uid = "user_" + Math.random().toString(36).substring(2, 10)
      localStorage.setItem("user_id", uid)
    }

    const payload = {
      ...qaData,
      user_id: uid,
      left_thresholds: finalThresholds.left,
      right_thresholds: finalThresholds.right,
      frequencies: FREQUENCIES,
      pta_left: ptaLeft.toFixed(1),
      pta_right: ptaRight.toFixed(1),
      who_grade_left: getWHOGrade(ptaLeft).grade,
      who_grade_right: getWHOGrade(ptaRight).grade,
    }

    try {
      const res = await fetch("https://hearsafe-backend.onrender.com/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      const resultToStore = {
        ...data,
        left_thresholds: finalThresholds.left,
        right_thresholds: finalThresholds.right,
        frequencies: FREQUENCIES,
        pta_left: ptaLeft.toFixed(1),
        pta_right: ptaRight.toFixed(1),
        who_grade_left: getWHOGrade(ptaLeft),
        who_grade_right: getWHOGrade(ptaRight),
      }

      // Save to localStorage for results page
      localStorage.setItem("analysisResult", JSON.stringify(resultToStore))

      // Save to Firestore if user is logged in
      if (currentUser) {
        await addDoc(
          collection(db, "users", currentUser.uid, "hearingTests"),
          {
            testDate: Timestamp.now(),
            totalScore: data.overall_score ?? Math.round(100 - (ptaLeft + ptaRight) / 2),
            riskLevel: data.risk || "GREEN",
            ptaLeft: parseFloat(ptaLeft.toFixed(1)),
            ptaRight: parseFloat(ptaRight.toFixed(1)),
            whoGradeLeft: getWHOGrade(ptaLeft).grade,
            whoGradeRight: getWHOGrade(ptaRight).grade,
            whoLabelLeft: getWHOGrade(ptaLeft).label,
            whoLabelRight: getWHOGrade(ptaRight).label,
            leftThresholds: finalThresholds.left,
            rightThresholds: finalThresholds.right,
            frequencies: FREQUENCIES,
            ehfaMean: data.ehfa_mean ?? null,
            hfShiftIndex: data.hf_shift_index ?? null,
            cli: data.cli ?? null,
            age: qaData.age ?? null,
            sex: qaData.sex ?? null,
          }
        )
        console.log("✅ Test saved to Firestore")
      }
    } catch (err) {
      console.error("Backend or Firestore error:", err)
    }

    // ← submitResults ends here — router.push is now OUTSIDE the catch
    //   so it always navigates after try/catch completes
    setLoading(false)
    router.push("/results")
  } // ← submitResults closes here ✅

  // ─── CALIBRATION PAGE ────────────────────────────────────────────────────────
  if (stage === "calibration") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <WaveBackground />
        <Card className="w-full max-w-xl p-8 relative z-10">

          {/* Step badge */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-base">tune</span>
            </div>
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              Step 1 of 2 — Calibration
            </span>
          </div>

          <h1 className="text-3xl font-bold mb-2">Before We Begin</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            We'll play a 1,000 Hz reference tone. Adjust the slider until it sounds clear
            and comfortable. This calibration ensures your results are medically accurate.
          </p>

          {/* Checklist */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Please confirm before starting
            </p>
            <div className="space-y-2">
              {[
                "I am using headphones or earphones",
                "I am in a quiet room with minimal background noise",
                "My device volume is at a comfortable level",
              ].map((text, i) => (
                <label
                  key={i}
                  onClick={() => toggleCheck(i)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${calChecks[i]
                    ? "bg-primary/5 border-primary/30"
                    : "border-border hover:bg-secondary/50"
                    }`}
                >
                  <span className={`material-symbols-outlined text-xl transition-colors ${calChecks[i] ? "text-primary" : "text-muted-foreground"}`}>
                    {calChecks[i] ? "check_box" : "check_box_outline_blank"}
                  </span>
                  <span className="text-sm">{text}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-border my-6" />

          {/* Reference tone */}
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Reference Tone — 1,000 Hz
          </p>

          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Volume Level</span>
              <span className="font-bold text-primary">{calDb} dB</span>
            </div>
            <input
              type="range"
              min={MIN_DB} max={MAX_DB} step={5} value={calDb}
              onChange={e => setCalDb(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Quiet</span>
              <span>Loud</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full mb-6"
            onClick={() => playTone(1000, calDb, 1500, "left")}
          >
            <span className="material-symbols-outlined text-base mr-2">
              {isPlaying ? "volume_up" : "play_circle"}
            </span>
            {isPlaying ? "Playing Tone…" : "Play Reference Tone"}
          </Button>

          <p className="text-sm text-muted-foreground mb-3">Did you hear the tone clearly?</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              variant={calibrationHeard === true ? "default" : "outline"}
              onClick={() => setCalibrationHeard(true)}
            >
              <span className="material-symbols-outlined text-base mr-1">check</span>
              Yes, clearly
            </Button>
            <Button
              variant={calibrationHeard === false ? "default" : "outline"}
              onClick={() => setCalibrationHeard(false)}
            >
              <span className="material-symbols-outlined text-base mr-1">close</span>
              No / Unclear
            </Button>
          </div>

          {calibrationHeard === false && (
            <div className="mb-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg flex gap-3">
              <span className="material-symbols-outlined text-orange-500 flex-shrink-0">warning</span>
              <p className="text-sm text-orange-600">
                Please adjust your device volume or check your headphone connection, then try again.
              </p>
            </div>
          )}

          <Button
            className="w-full"
            disabled={calibrationHeard !== true || !allChecked}
            onClick={() => setStage("testing")}
          >
            Begin Hearing Test
            <span className="material-symbols-outlined text-base ml-2">arrow_forward</span>
          </Button>

          {(!allChecked && calibrationHeard === true) && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Please tick all checkboxes above to continue.
            </p>
          )}
        </Card>
      </div>
    )
  }

  // ─── DONE / LOADING PAGE ─────────────────────────────────────────────────────
  if (stage === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <WaveBackground />
        <Card className="w-full max-w-md p-10 relative z-10 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Analysing Your Results</h1>
          <p className="text-muted-foreground">
            Calculating hearing thresholds, PTA scores & WHO classification…
          </p>
        </Card>
      </div>
    )
  }

  // ─── TESTING PAGE ────────────────────────────────────────────────────────────
  const progressPct = Math.round((completedSteps / totalSteps) * 100)

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <WaveBackground />
      <Card className="w-full max-w-2xl p-8 relative z-10">

        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">hearing</span>
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              Pure Tone Audiometry
            </span>
          </div>
          {/* Ear badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border ${currentEar === "left"
            ? "bg-blue-500/10 border-blue-500/30 text-blue-600"
            : "bg-purple-500/10 border-purple-500/30 text-purple-600"
            }`}>
            <span className="material-symbols-outlined text-base">hearing</span>
            {currentEar === "left" ? "◀ Left Ear" : "Right Ear ▶"}
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>Overall Progress</span>
          <span className="font-semibold text-primary">{completedSteps} / {totalSteps} frequencies</span>
        </div>
        <div className="w-full h-2 bg-secondary rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Frequency step dots */}
        <div className="flex gap-2 justify-center mb-6 flex-wrap">
          {FREQUENCIES.map((_, i) => (
            <div
              key={i}
              title={FREQ_LABELS[i]}
              className={`w-3 h-3 rounded-full border transition-all duration-300 ${i < currentFreqIndex
                ? "bg-primary border-primary"
                : i === currentFreqIndex
                  ? "bg-primary/40 border-primary scale-125"
                  : "bg-secondary border-border"
                }`}
            />
          ))}
        </div>

        <div className="border-t border-border my-4" />

        {/* Frequency & dB display */}
        <div className="text-center my-6">
          <p className="text-lg text-muted-foreground font-light mb-1">
            {FREQ_LABELS[currentFreqIndex]}
          </p>
          <p className="text-6xl font-bold text-primary leading-none">{currentDb}</p>
          <p className="text-lg text-muted-foreground mt-1">dB HL</p>
          <p className="text-xs text-muted-foreground mt-2">
            Adjust until you can <em>just barely</em> hear the tone
          </p>
        </div>

        {/* Volume slider */}
        <div className="mb-6">
          <input
            type="range"
            min={MIN_DB} max={MAX_DB} step={STEP_DB} value={currentDb}
            onChange={e => { setCurrentDb(parseInt(e.target.value)); setToneHeard(null) }}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{MIN_DB} dB (Quiet)</span>
            <span>{MAX_DB} dB (Loud)</span>
          </div>
        </div>

        {/* Play button */}
        <Button
          className="w-full mb-6 text-base"
          onClick={() => playTone(currentFreq, currentDb, 1500, currentEar)}
        >
          <span className="material-symbols-outlined mr-2">
            {isPlaying ? "volume_up" : "play_circle"}
          </span>
          {isPlaying ? "Playing Tone…" : "Play Tone"}
        </Button>

        {/* Attempt dots */}
        {attempts > 0 && (
          <div className="flex justify-center gap-2 mb-3">
            {Array.from({ length: attempts }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${i < yesCount ? "bg-green-500" : "bg-red-400"}`}
              />
            ))}
          </div>
        )}

        {/* Response */}
        <p className="text-sm text-muted-foreground text-center mb-3">
          Did you hear the tone?
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => handleResponse(true)}
            className={`py-4 rounded-xl border-2 font-semibold text-base transition-all ${toneHeard === true
              ? "bg-green-500/20 border-green-500 text-green-700"
              : "border-border hover:bg-secondary/60 text-foreground"
              }`}
          >
            <span className="material-symbols-outlined align-middle mr-1 text-base">check</span>
            Yes, I heard it
          </button>
          <button
            onClick={() => handleResponse(false)}
            className={`py-4 rounded-xl border-2 font-semibold text-base transition-all ${toneHeard === false
              ? "bg-red-500/20 border-red-400 text-red-700"
              : "border-border hover:bg-secondary/60 text-foreground"
              }`}
          >
            <span className="material-symbols-outlined align-middle mr-1 text-base">close</span>
            No, I didn't
          </button>
        </div>

        {/* Confirm & next */}
        {toneHeard !== null && (
          <Button variant="outline" className="w-full" onClick={handleManualNext}>
            {currentFreqIndex < FREQUENCIES.length - 1 || currentEarIndex < EARS.length - 1
              ? "Confirm & Next Frequency"
              : loading ? "Analysing…" : "Submit & Get Results"}
            <span className="material-symbols-outlined text-base ml-2">arrow_forward</span>
          </Button>
        )}

        {/* Footer note */}
        <p className="text-xs text-muted-foreground text-center mt-6">
          Testing {currentEar} ear · Frequency {currentFreqIndex + 1} of {FREQUENCIES.length}
          {currentEarIndex < EARS.length - 1 ? " · Right ear up next" : " · Final ear"}
        </p>
      </Card>
    </div>
  )
} // ← HearingTestPage closes here ✅