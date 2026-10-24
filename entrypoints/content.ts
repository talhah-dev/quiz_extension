export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    let dotElement: HTMLElement | null = null;
    let answerTextElement: HTMLElement | null = null;
    let selectedQuestionText = '';
    let autoDismissTimer: any = null;
    let isSolving = false;

    const removeUI = () => {
      if (dotElement) {
        dotElement.remove();
        dotElement = null;
      }
      if (answerTextElement) {
        answerTextElement.remove();
        answerTextElement = null;
      }
      if (autoDismissTimer) {
        clearTimeout(autoDismissTimer);
        autoDismissTimer = null;
      }
      isSolving = false;
    };

    // Detect text selection on webpage
    document.addEventListener('mouseup', (e) => {
      // Ignore if clicking on our dot or answer text
      if (
        (dotElement && dotElement.contains(e.target as Node)) ||
        (answerTextElement && answerTextElement.contains(e.target as Node))
      ) {
        return;
      }

      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();

        if (!text || text.length < 6) {
          if (!answerTextElement && !isSolving) {
            removeUI();
          }
          return;
        }

        selectedQuestionText = text;
        showTinyRedDot();
      }, 10);
    });

    // Create ultra-tiny square box (6px) touching the bottom-right corner
    function showTinyRedDot() {
      if (dotElement) {
        dotElement.style.backgroundColor = '#ef4444';
        return;
      }

      const dot = document.createElement('div');
      dot.id = 'ai-stealth-corner-box';
      dot.title = '';

      Object.assign(dot.style, {
        position: 'fixed',
        bottom: '0px',
        right: '0px',
        width: '6px',
        height: '6px',
        borderRadius: '0px',
        backgroundColor: '#ef4444',
        zIndex: '2147483647',
        cursor: 'pointer',
        transformOrigin: 'bottom right',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      });

      // Subtle hover feedback
      dot.addEventListener('mouseenter', () => {
        dot.style.transform = 'scale(1.6)';
      });
      dot.addEventListener('mouseleave', () => {
        dot.style.transform = 'scale(1)';
      });

      // Click handler
      dot.addEventListener('click', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();

        if (isSolving) return;
        isSolving = true;

        // 1. Turn dot into Blue while loading
        dot.style.backgroundColor = '#3b82f6';

        // 2. Request answer from background AI worker
        try {
          chrome.runtime.sendMessage(
            { action: 'SOLVE_MCQ', question: selectedQuestionText },
            (response) => {
              isSolving = false;
              const runtimeErr = chrome.runtime?.lastError?.message;

              if (runtimeErr) {
                console.error('[MCQ Runtime Error]', runtimeErr);
                dot.style.backgroundColor = '#ef4444';
                showBottomLeftAnswer('Reload Tab');
                return;
              }

              if (!response || !response.success) {
                console.error('[MCQ Solver Response Error]', response);
                dot.style.backgroundColor = '#ef4444';
                const msg = response?.error || 'Server busy';
                showBottomLeftAnswer(msg.length > 25 ? msg.slice(0, 25) + '...' : msg);
                return;
              }

              // 3. Turn dot green when completed
              dot.style.backgroundColor = '#10b981';

              const { correctAnswer } = response.data;
              showBottomLeftAnswer(correctAnswer);
            }
          );
        } catch (err: any) {
          isSolving = false;
          dot.style.backgroundColor = '#ef4444';
          showBottomLeftAnswer('Reload Tab');
        }
      });

      document.body.appendChild(dot);
      dotElement = dot;
    }

    // Display ultra-stealth text at bottom-left corner with transparent background
    function showBottomLeftAnswer(answerText: string) {
      if (answerTextElement) {
        answerTextElement.remove();
      }

      const el = document.createElement('div');
      el.id = 'ai-stealth-bottom-left-answer';
      el.textContent = answerText;

      Object.assign(el.style, {
        position: 'fixed',
        bottom: '4px',
        left: '6px',
        zIndex: '2147483647',
        backgroundColor: 'transparent',
        color: '#111827',
        fontSize: '11px',
        fontWeight: '700',
        fontFamily: 'monospace, -apple-system, BlinkMacSystemFont, sans-serif',
        lineHeight: '1',
        padding: '0',
        margin: '0',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        cursor: 'pointer',
        userSelect: 'text',
        opacity: '0.88',
        transition: 'opacity 0.2s ease',
      });

      // Click to dismiss
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeUI();
      });

      document.body.appendChild(el);
      answerTextElement = el;

      // Auto dismiss after 20 seconds
      if (autoDismissTimer) clearTimeout(autoDismissTimer);
      autoDismissTimer = setTimeout(() => {
        removeUI();
      }, 20000);
    }
  },
});
