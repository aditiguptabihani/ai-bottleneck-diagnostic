'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const questions = [
  { id: 'q1', text: 'What are you trying to achieve with AI right now?' },
  { id: 'q2', text: 'Where did you last actually make progress?' },
  { id: 'q3', text: 'What do you think is blocking you?' },
  { id: 'q4', text: 'How long have you been stuck here?' },
  { id: 'q5', text: 'Walk me through the last time you sat down to work on this. What actually happened?' },
  { id: 'q6', text: 'What have you tried to fix it?' },
  { id: 'q7', text: 'Did that work? Why not?' },
  { id: 'q8', text: 'What would you do tomorrow if the blocker magically disappeared?' },
  { id: 'q9', text: 'What would you be embarrassed to admit is the real reason?' },
  { id: 'q10', text: 'If someone handed you one thing that would actually move you, what would it need to be?' }
]

interface Diagnosis {
  stated_blocker: string
  behavioral_signals: string
  contradiction_evidence: string
  bottleneck_type: string
  pattern_summary: string
  diagnosis_sentence: string
  predicted_fix_that_wont_work: string
  why_fix_wont_work: string
}

export default function Home() {
  const [step, setStep] = useState('landing')
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  const handleSignIn = async () => {
    setAuthLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      setAuthMessage('Error: ' + error.message)
    } else {
      setAuthMessage('Check your email for a magic link to sign in!')
    }
    setAuthLoading(false)
  }

  const handleNext = () => {
    if (!currentAnswer.trim()) return
    const newAnswers = { ...answers, [questions[currentQ].id]: currentAnswer }
    setAnswers(newAnswers)
    setCurrentAnswer('')
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1)
    } else {
      handleSubmit(newAnswers)
    }
  }

  const handleSubmit = async (finalAnswers: Record<string, string>) => {
    setStep('loading')
    setLoading(true)
    try {
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: finalAnswers })
      })
      const data = await res.json()
      if (data.success) {
        setDiagnosis(data.diagnosis)
        await saveToDatabase(finalAnswers, data.diagnosis)
        setStep('result')
      } else {
        alert('Something went wrong. Please try again.')
        setStep('questions')
      }
    } catch (err: unknown) {
      alert('Error: ' + (err as Error).message)
      setStep('questions')
    }
    setLoading(false)
  }

  const saveToDatabase = async (finalAnswers: Record<string, string>, diag: Diagnosis) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || null

      const { data: session } = await supabase
        .from('sessions')
        .insert({
          user_id: userId,
          answers: finalAnswers,
          stated_blocker: diag.stated_blocker,
          behavioral_signals: diag.behavioral_signals,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      if (session) {
        const { data: diagnosisRow } = await supabase
          .from('diagnoses')
          .insert({
            session_id: session.id,
            bottleneck_type: diag.bottleneck_type,
            contradiction_evidence: diag.contradiction_evidence,
            diagnosis_sentence: diag.diagnosis_sentence,
            predicted_fix_that_wont_work: diag.predicted_fix_that_wont_work,
            pattern_summary: diag.pattern_summary
          })
          .select()
          .single()

        if (diagnosisRow) {
          await supabase.from('outcomes').insert({
            diagnosis_id: diagnosisRow.id,
            reaction: 'pending'
          })
        }
      }
    } catch (err: unknown) {
      console.error('DB save error:', err)
    }
  }

  const handleReaction = async (reaction: string) => {
    try {
      await supabase
        .from('outcomes')
        .update({ reaction, recorded_at: new Date().toISOString() })
        .eq('reaction', 'pending')
      setStep('thankyou')
    } catch (err: unknown) {
      console.error(err)
      setStep('thankyou')
    }
  }

  if (step === 'landing') return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-4xl font-bold mb-4">Leverage Detector</h1>
        <p className="text-gray-400 text-lg mb-8">
          Answer 10 questions. Get the one sentence that names what is actually blocking you — not what you think is blocking you.
        </p>
        <div className="bg-gray-900 rounded-xl p-6 mb-6">
          <p className="text-sm text-gray-400 mb-3">Sign in with your email to save your diagnosis</p>
          <input
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 mb-3 outline-none"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
          />
          <button
            onClick={handleSignIn}
            disabled={authLoading || !email}
            className="w-full bg-white text-black font-semibold py-3 rounded-lg mb-2 disabled:opacity-50"
          >
            {authLoading ? 'Sending...' : 'Send Magic Link'}
          </button>
          {authMessage && <p className="text-sm text-green-400 mt-2">{authMessage}</p>}
        </div>
        <button
          onClick={() => setStep('questions')}
          className="text-gray-500 underline text-sm"
        >
          Continue without signing in
        </button>
      </div>
    </main>
  )

  if (step === 'loading') return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-6">🔍</div>
        <p className="text-xl text-gray-400">Finding your real blocker...</p>
      </div>
    </main>
  )

  if (step === 'questions') return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full">
        <div className="flex gap-1 mb-8">
          {questions.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded ${i <= currentQ ? 'bg-white' : 'bg-gray-800'}`} />
          ))}
        </div>
        <p className="text-sm text-gray-500 mb-3">Question {currentQ + 1} of {questions.length}</p>
        <h2 className="text-xl font-semibold mb-6">{questions[currentQ].text}</h2>
        <textarea
          className="w-full bg-gray-900 text-white rounded-xl p-4 h-40 outline-none resize-none mb-4"
          placeholder="Be honest. The more specific, the more accurate the diagnosis."
          value={currentAnswer}
          onChange={e => setCurrentAnswer(e.target.value)}
          autoFocus
        />
        <button
          onClick={handleNext}
          disabled={!currentAnswer.trim()}
          className="w-full bg-white text-black font-semibold py-3 rounded-xl disabled:opacity-30"
        >
          {currentQ < questions.length - 1 ? 'Next →' : 'Get My Diagnosis'}
        </button>
      </div>
    </main>
  )

  if (step === 'result' && diagnosis) return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full">
        <h2 className="text-2xl font-bold mb-8 text-center">Your Diagnosis</h2>
        <div className="bg-gray-900 rounded-xl p-6 mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Your Real Blocker</p>
          <p className="text-lg font-semibold text-white">{diagnosis.diagnosis_sentence}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Pattern Detected</p>
          <p className="text-gray-300">{diagnosis.pattern_summary}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">The Fix You Will Reach For</p>
          <p className="text-gray-300">{diagnosis.predicted_fix_that_wont_work}</p>
          <p className="text-red-400 text-sm mt-2">⚠ {diagnosis.why_fix_wont_work}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">What the Evidence Shows</p>
          <p className="text-gray-300 text-sm">{diagnosis.contradiction_evidence}</p>
        </div>
        <p className="text-center text-gray-400 mb-4">Did this land?</p>
        <div className="flex gap-3">
          <button
            onClick={() => handleReaction('acted')}
            className="flex-1 bg-white text-black font-semibold py-3 rounded-xl"
          >
            Yes — I know what to do
          </button>
          <button
            onClick={() => handleReaction('nodded')}
            className="flex-1 bg-gray-800 text-white font-semibold py-3 rounded-xl"
          >
            Not really
          </button>
        </div>
      </div>
    </main>
  )

  if (step === 'thankyou') return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center">
        <div className="text-6xl mb-6">✓</div>
        <h2 className="text-2xl font-bold mb-4">Thank you</h2>
        <p className="text-gray-400">Your response has been recorded. Come back when you want to check another blocker.</p>
      </div>
    </main>
  )
}