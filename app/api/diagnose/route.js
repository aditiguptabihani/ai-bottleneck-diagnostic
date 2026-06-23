import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

const BOTTLENECK_TYPES = [
  "Debugging by delegation - uses AI to fix errors without understanding why they happen",
  "Infinite preparation loop - keeps learning/planning but never ships",
  "Validation dependency - needs external approval before acting",
  "Scope paralysis - idea is too big, cannot find the starting point",
  "Context switching collapse - too many priorities, none get depth",
  "Execution gap - knows what to do strategically but lacks operational experience"
]

export async function POST(request) {
  try {
    const { answers } = await request.json()

    const prompt = `You are a precise AI bottleneck diagnostician. Your job is to find the REAL blocker, not the stated one.

Here are a person's answers to 10 questions about their AI journey:

Q1 - What are you trying to achieve with AI: ${answers.q1}
Q2 - Where did you last make progress: ${answers.q2}
Q3 - What do you think is blocking you (STATED BLOCKER): ${answers.q3}
Q4 - How long stuck: ${answers.q4}
Q5 - Last time they sat down to work, what happened: ${answers.q5}
Q6 - What have they tried: ${answers.q6}
Q7 - Did that work, why not: ${answers.q7}
Q8 - What would they do if blocker disappeared: ${answers.q8}
Q9 - Embarrassing real reason: ${answers.q9}
Q10 - What would actually move them: ${answers.q10}

BOTTLENECK TYPES to choose from (pick exactly one):
${BOTTLENECK_TYPES.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Your task:
1. Find the contradiction between what they SAID (Q3) and what their BEHAVIOR shows (Q5, Q6, Q7)
2. Pick the bottleneck type that fits their behavior, not their stated reason
3. Write one precise diagnosis sentence - true of them, false of most others
4. Name the fix they are about to reach for, and predict why it will not work

Respond in this exact JSON format:
{
  "stated_blocker": "what they said in Q3",
  "behavioral_signals": "what Q5/Q6/Q7 actually reveals about their behavior",
  "contradiction_evidence": "the specific gap between what they said and what they did",
  "bottleneck_type": "exact text of the chosen bottleneck type",
  "pattern_summary": "2 sentence summary of the pattern you detected",
  "diagnosis_sentence": "the one precise sentence true of them and false of most others",
  "predicted_fix_that_wont_work": "the fix they will reach for",
  "why_fix_wont_work": "one sentence explaining why that fix will fail"
}`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].text
    const clean = responseText.replace(/```json|```/g, '').trim()
    const diagnosis = JSON.parse(clean)

    return Response.json({ success: true, diagnosis })
  } catch (error) {
    console.error('Diagnosis error:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}