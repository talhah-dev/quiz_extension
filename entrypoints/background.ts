export default defineBackground(() => {
  console.log('[AI MCQ Solver] Background worker started with resilient multi-model fallback.');

  // Listen for messages from Content Script and Popup
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'SOLVE_MCQ') {
      handleSolveMCQ(message.question)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message || 'Unknown error' }));
      return true; // Keep message channel open for async response
    }
  });
});

const GEMINI_API_KEY = 'AIzaSyAItRaWqVWSlM1BYH1-9fvfDx02TA2-Evg';

// List of top-tier fast models in order of priority for automatic failover
const MODELS_CASCADE = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.7-flash'];

async function handleSolveMCQ(questionText: string) {
  const prompt = `You are a high-speed exam assistant. A student highlighted this multiple choice question (MCQ) or quiz problem on their screen.
Identify the question and its choices, and determine the single correct option.

Strictly return a JSON object with this exact structure:
{
  "correctAnswer": "Shortest direct answer: option letter and word (e.g. 'B) Mars')",
  "confidence": "High" | "Medium",
  "explanation": "One single brief sentence explaining why."
}

User Question:
"""
${questionText}
"""`;

  let lastErrorMsg = 'Failed to get answer from AI.';

  // Attempt models in sequence; if one is experiencing high demand (503), automatically use the next
  for (const model of MODELS_CASCADE) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        const errorMsg = errorJson?.error?.message || `API error (${response.status})`;
        lastErrorMsg = errorMsg;

        // If high demand or overloaded, gracefully cascade to the next model in the list
        if (response.status === 503 || errorMsg.toLowerCase().includes('demand') || errorMsg.toLowerCase().includes('overloaded')) {
          console.warn(`[MCQ Solver] ${model} high demand, failing over to next model...`);
          continue;
        }

        return { success: false, error: errorMsg };
      }

      const data = await response.json();
      const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!rawContent) {
        continue;
      }

      let cleanJson = rawContent;
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleanJson.trim());

      // Save to history in storage
      const historyItem = {
        id: Date.now().toString(),
        question: questionText.slice(0, 150) + (questionText.length > 150 ? '...' : ''),
        correctAnswer: parsed.correctAnswer,
        explanation: parsed.explanation,
        confidence: parsed.confidence || 'High',
        timestamp: Date.now(),
      };

      chrome.storage.local.get(['solved_history', 'gemini_usage'], (res) => {
        const history = (res.solved_history as any[]) || [];
        const updatedHistory = [historyItem, ...history.slice(0, 19)];

        // Track daily usage against free tier (1,500 requests/day)
        const todayDate = new Date().toISOString().slice(0, 10);
        const currentUsage = (res.gemini_usage as { date?: string; count?: number } | undefined) || { date: todayDate, count: 0 };
        const newCount = currentUsage.date === todayDate ? (currentUsage.count || 0) + 1 : 1;

        chrome.storage.local.set({
          solved_history: updatedHistory,
          gemini_usage: { date: todayDate, count: newCount },
        });
      });

      return {
        success: true,
        data: parsed,
      };
    } catch (err: any) {
      lastErrorMsg = err.message || 'Network error';
    }
  }

  return {
    success: false,
    error: lastErrorMsg,
  };
}
