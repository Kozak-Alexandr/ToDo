const DEFAULT_TASKS = [
  "Check email & replies",
  "Standup / plan",
  "Work on main ticket",
  "Review PRs",
  "Wrap up & notes"
];

const DATE_EL = document.getElementById('date');
const TASKS_EL = document.getElementById('tasks');
const ADD_BTN = document.getElementById('addBtn');
const CLEAR_BTN = document.getElementById('clearBtn');
const EYES = document.getElementById('eyes');

function todayDateString() {
  const d = new Date();
  // Display using system locale and short format
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function loadState() {
  try {
    const raw = localStorage.getItem('aod_tasks_v2');
    if (!raw) return { tasks: DEFAULT_TASKS.map(t => ({ text: t, done: false })) };
    return JSON.parse(raw);
  } catch (e) {
    console.error(e);
    return { tasks: DEFAULT_TASKS.map(t => ({ text: t, done: false })) };
  }
}

function saveState(state) {
  localStorage.setItem('aod_tasks_v2', JSON.stringify(state));
}

// initial load
let state = loadState();
if (!state.tasks || !Array.isArray(state.tasks)) state = { tasks: DEFAULT_TASKS.map(t => ({ text: t, done: false })) };

function render() {
  DATE_EL.textContent = todayDateString();
  TASKS_EL.innerHTML = '';

  state.tasks.forEach((task, idx) => {
    const li = document.createElement('li');
    li.className = 'task';

    const check = document.createElement('div');
    check.className = 'check ' + (task.done ? 'done' : 'empty');
    check.innerHTML = task.done ? '✔' : (task.text ? '' : '+');
    check.title = task.done ? 'Mark undone' : 'Mark done';
    check.addEventListener('click', (e) => {
      e.stopPropagation();
      state.tasks[idx].done = !state.tasks[idx].done;
      saveState(state);
      render();
    });

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = task.text || 'Add task';
    // inline edit: clicking label replaces with input
    label.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'text';
      input.value = task.text || '';
      input.style.width = '100%';
      input.style.fontSize = '14px';
      input.style.padding = '4px 6px';
      // replace label with input
      li.replaceChild(input, label);
      input.focus();
      input.select();
      function commit() {
        const newText = input.value.trim();
        const originalText = task.text || '';
        if (newText === '' && newText !== originalText) {
          // delete only if user explicitly cleared the text
          state.tasks.splice(idx, 1);
        } else if (newText !== '') {
          state.tasks[idx] = { text: newText, done: false };
        }
        // if newText === '' and originalText === '', do nothing (keep empty task)
        saveState(state);
        render();
      }
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          commit();
        } else if (ev.key === 'Escape') {
          render();
        }
      });
    });

    // delete button (X)
    const del = document.createElement('button');
    del.className = 'deleteBtn';
    del.innerHTML = '✕';
    del.title = 'Delete task';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      // remove item
      state.tasks.splice(idx, 1);
      saveState(state);
      render();
    });

    li.appendChild(check);
    li.appendChild(label);
    li.appendChild(del);
    TASKS_EL.appendChild(li);
  });

  // Dynamic resize: calculate height based on content, capped at 5 tasks
  const widget = document.getElementById('widget');
  if (widget && window.aodAPI && window.aodAPI.resizeWindow) {
    setTimeout(() => {
      // Default to full height
      let targetHeight = widget.scrollHeight;

      // Check if we have more than 5 tasks
      const taskElements = document.querySelectorAll('.task');
      if (taskElements.length > 5) {
        // Get the bottom of the 5th task
        const fifthTask = taskElements[4];
        const rect = fifthTask.getBoundingClientRect();
        // We need the position relative to the top of the widget (scrolling container)
        // But getBoundingClientRect is viewport relative. 
        // Since widget is top of viewport (mostly), rect.bottom is roughly the height we want.
        // Let's add a little padding for the bottom shadow/margin
        targetHeight = rect.bottom + 10;
      }

      window.aodAPI.resizeWindow(targetHeight);
    }, 0);
  }
}

ADD_BTN.addEventListener('click', () => {
  // Fix: directly add empty task instead of prompt
  state.tasks.push({ text: '', done: false });
  saveState(state);
  render();
});

CLEAR_BTN.addEventListener('click', () => {
  state.tasks = state.tasks.filter(t => !t.done);
  saveState(state);
  render();
});

render();

/* Eye-following logic */
(function eyesFollow() {
  const eyesEl = document.getElementById('eyes');
  if (!eyesEl) return;
  const pupils = Array.from(document.querySelectorAll('.eye .pupil'));

  // compute pupil translation limited to radius
  function movePupils(clientX, clientY) {
    pupils.forEach((pupil) => {
      const eye = pupil.parentElement;
      const rect = eye.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // vector from center to cursor
      const dx = clientX - cx;
      const dy = clientY - cy;
      // max pupil travel
      const max = 8;
      // normalize and scale
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const tx = (dx / dist) * Math.min(max, dist / 8);
      const ty = (dy / dist) * Math.min(max, dist / 8);
      pupil.style.transform = `translate(${tx}px, ${ty}px)`;
    });
  }

  // Use global cursor position from main process
  if (window.aodAPI && window.aodAPI.onCursorMove) {
    window.aodAPI.onCursorMove((point) => {
      // point is {x, y} in screen coordinates
      // We need to convert screen coordinates to client coordinates relative to this window
      // But since we don't easily know our window position here without more IPC, 
      // we can rely on the fact that for a transparent frameless window, 
      // clientX/Y usually maps closely if we assume the window is at (0,0) of the screen? 
      // NO, that's wrong. 

      // Actually, we can just use the screen coordinates if we calculate the eye position in screen coordinates too.
      // But `getBoundingClientRect` returns viewport coordinates.
      // Let's use `window.screenX` and `window.screenY` to offset.

      const localX = point.x - window.screenX;
      const localY = point.y - window.screenY;
      movePupils(localX, localY);
    });
  } else {
    // Fallback to local mousemove if API not available
    window.addEventListener('mousemove', (e) => {
      movePupils(e.clientX, e.clientY);
    });
  }

  // Also nudge on touch (for touchscreens)
  window.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (t) movePupils(t.clientX, t.clientY);
  }, { passive: true });

})();
