/**
 * CaliTracker - Core Logic
 */

// --- Constants & Data ---
const EXERCISES = [
    'Pull-ups',
    'Push-ups',
    'Dips',
    'Squats',
    'Muscle-ups',
    'Chin-ups',
    'Plank (sec)'
];

// --- Storage Manager ---
class Storage {
    static KEY = 'calitracker_data';

    static load() {
        const data = localStorage.getItem(this.KEY);
        return data ? JSON.parse(data) : { history: [], settings: { streak: 0, bestStreak: 0 } };
    }

    static save(data) {
        localStorage.setItem(this.KEY, JSON.stringify(data));
    }

    static addWorkout(workout) {
        const data = this.load();
        data.history.unshift(workout);
        this.updateStreak(data);
        this.save(data);
    }

    static updateStreak(data) {
        if (data.history.length === 0) return;
        
        // Simple streak logic: consecutive days
        const today = new Date().toDateString();
        const lastWorkout = new Date(data.history[0].date).toDateString();
        
        // This is a simplified version for now
        if (today === lastWorkout) {
            // Check if streak was already updated today
            // For now, let's just mock it
            data.settings.streak = (data.settings.streak || 0) + 1;
        }

        if (data.settings.streak > data.settings.bestStreak) {
            data.settings.bestStreak = data.settings.streak;
        }
    }
}

// --- App State ---
const state = {
    currentView: 'dashboard',
    activeWorkout: null,
    timerInterval: null,
    startTime: null
};

// --- UI Components ---
const UI = {
    container: document.getElementById('view-container'),
    navBtns: document.querySelectorAll('.nav-btn'),
    streakCount: document.getElementById('streak-count'),

    renderView(viewName) {
        state.currentView = viewName;
        
        // Update Nav
        this.navBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        // Load Template
        const template = document.getElementById(`tpl-${viewName}`);
        this.container.innerHTML = '';
        this.container.appendChild(template.content.cloneNode(true));

        // View Specific Initialization
        if (viewName === 'dashboard') this.initDashboard();
        if (viewName === 'workout') this.initWorkout();
        if (viewName === 'history') this.initHistory();
    },

    initDashboard() {
        const data = Storage.load();
        document.getElementById('stat-total').textContent = data.history.length;
        document.getElementById('stat-best-streak').textContent = data.settings.bestStreak || 0;
        this.streakCount.textContent = data.settings.streak || 0;
    },

    initHistory() {
        const data = Storage.load();
        const historyList = document.getElementById('history-list');
        
        if (data.history.length === 0) return;

        historyList.innerHTML = '';
        data.history.forEach(workout => {
            const item = document.createElement('div');
            item.className = 'history-item glass fade-in';
            
            const date = new Date(workout.date).toLocaleDateString(undefined, { 
                weekday: 'short', month: 'short', day: 'numeric' 
            });

            const summary = workout.exercises.map(ex => ex.name).slice(0, 3).join(', ');

            item.innerHTML = `
                <div class="history-date">${date}</div>
                <div class="history-title">${workout.name || 'Workout'}</div>
                <div class="history-summary">
                    ${workout.exercises.map(ex => `<span class="history-tag">${ex.name}</span>`).join('')}
                </div>
            `;
            historyList.appendChild(item);
        });
    },

    initWorkout() {
        if (!state.activeWorkout) {
            this.startNewWorkout();
        } else {
            this.resumeWorkout();
        }
        
        document.getElementById('add-exercise-btn').onclick = () => this.showExercisePicker();
        document.getElementById('finish-workout-btn').onclick = () => this.finishWorkout();
    },

    startNewWorkout() {
        state.activeWorkout = {
            date: new Date().toISOString(),
            exercises: []
        };
        state.startTime = Date.now();
        this.startTimer();
    },

    resumeWorkout() {
        const container = document.getElementById('active-exercises');
        state.activeWorkout.exercises.forEach((ex, idx) => {
            container.appendChild(this.createExerciseCard(ex, idx));
        });
        this.startTimer();
    },

    startTimer() {
        if (state.timerInterval) clearInterval(state.timerInterval);
        const timerEl = document.getElementById('workout-timer');
        
        state.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
            const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const s = (elapsed % 60).toString().padStart(2, '0');
            if (timerEl) timerEl.textContent = `${m}:${s}`;
        }, 1000);
    },

    showExercisePicker() {
        // Simple prompt for now to keep code small
        const name = prompt("Select Exercise:\n" + EXERCISES.join('\n'));
        if (name && EXERCISES.includes(name)) {
            const exercise = { name, sets: [{ reps: 0, weight: 0 }] };
            state.activeWorkout.exercises.push(exercise);
            const container = document.getElementById('active-exercises');
            container.appendChild(this.createExerciseCard(exercise, state.activeWorkout.exercises.length - 1));
        }
    },

    createExerciseCard(exercise, exIdx) {
        const card = document.createElement('div');
        card.className = 'exercise-card glass fade-in';
        card.innerHTML = `
            <div class="exercise-title">
                <span>${exercise.name}</span>
            </div>
            <div class="sets-container" id="sets-ex-${exIdx}"></div>
            <button class="add-set-btn" onclick="UI.addSet(${exIdx})">+ Add Set</button>
        `;

        const setsContainer = card.querySelector('.sets-container');
        exercise.sets.forEach((set, setIdx) => {
            setsContainer.appendChild(this.createSetRow(exIdx, setIdx, set));
        });

        return card;
    },

    createSetRow(exIdx, setIdx, set) {
        const row = document.createElement('div');
        row.className = 'set-row';
        row.innerHTML = `
            <span class="set-num">${setIdx + 1}</span>
            <input type="number" placeholder="Reps" value="${set.reps || ''}" 
                onchange="UI.updateSet(${exIdx}, ${setIdx}, 'reps', this.value)">
            <input type="number" placeholder="Kg" value="${set.weight || ''}"
                onchange="UI.updateSet(${exIdx}, ${setIdx}, 'weight', this.value)">
            <button class="remove-set" onclick="UI.removeSet(${exIdx}, ${setIdx})">×</button>
        `;
        return row;
    },

    addSet(exIdx) {
        const exercise = state.activeWorkout.exercises[exIdx];
        const newSet = { reps: 0, weight: 0 };
        exercise.sets.push(newSet);
        const container = document.getElementById(`sets-ex-${exIdx}`);
        container.appendChild(this.createSetRow(exIdx, exercise.sets.length - 1, newSet));
    },

    updateSet(exIdx, setIdx, field, value) {
        state.activeWorkout.exercises[exIdx].sets[setIdx][field] = parseInt(value) || 0;
    },

    removeSet(exIdx, setIdx) {
        state.activeWorkout.exercises[exIdx].sets.splice(setIdx, 1);
        this.renderView('workout'); // Refresh view
    },

    finishWorkout() {
        if (state.activeWorkout.exercises.length === 0) {
            alert("Add at least one exercise!");
            return;
        }
        Storage.addWorkout(state.activeWorkout);
        state.activeWorkout = null;
        clearInterval(state.timerInterval);
        this.renderView('dashboard');
    }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Nav Listeners
    UI.navBtns.forEach(btn => {
        btn.onclick = () => UI.renderView(btn.dataset.view);
    });

    // Global UI exposure for inline handlers
    window.UI = UI;

    // Initial View
    UI.renderView('dashboard');
});
