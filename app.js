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
    'Plank (sec)',
    'Handstand (sec)',
    'Leg Raises'
];

const QUOTES = [
    "The only bad workout is the one that didn't happen.",
    "Don't stop when you're tired. Stop when you're done.",
    "Your body can stand almost anything. It's your mind that you have to convince.",
    "Discipline is doing what needs to be done, even if you don't want to do it.",
    "Strength does not come from winning. Your struggles develop your strengths.",
    "Focus on progress, not perfection.",
    "Success is the sum of small efforts, repeated day in and day out.",
    "It's not about being the best. It's about being better than you were yesterday."
];

// --- Storage Manager ---
class Storage {
    static KEY = 'calitracker_data';
    static ACTIVE_KEY = 'calitracker_active';

    static load() {
        const data = localStorage.getItem(this.KEY);
        const defaults = { 
            history: [], 
            settings: { 
                streak: 0, 
                bestStreak: 0, 
                weeklyGoal: 3,
                lastWorkoutDate: null
            } 
        };
        return data ? { ...defaults, ...JSON.parse(data) } : defaults;
    }

    static save(data) {
        localStorage.setItem(this.KEY, JSON.stringify(data));
    }

    static saveActiveWorkout(workout, startTime) {
        localStorage.setItem(this.ACTIVE_KEY, JSON.stringify({ workout, startTime }));
    }

    static loadActiveWorkout() {
        const data = localStorage.getItem(this.ACTIVE_KEY);
        return data ? JSON.parse(data) : null;
    }

    static clearActiveWorkout() {
        localStorage.removeItem(this.ACTIVE_KEY);
    }

    static addWorkout(workout) {
        const data = this.load();
        data.history.unshift(workout);
        this.updateStreak(data);
        this.save(data);
        this.clearActiveWorkout();
    }

    static deleteWorkout(index) {
        const data = this.load();
        data.history.splice(index, 1);
        this.save(data);
    }

    static updateStreak(data) {
        if (data.history.length === 0) return;
        
        const today = new Date().setHours(0,0,0,0);
        const lastWorkoutDate = new Date(data.history[0].date).setHours(0,0,0,0);
        const prevWorkoutDate = data.settings.lastWorkoutDate ? new Date(data.settings.lastWorkoutDate).setHours(0,0,0,0) : null;

        if (lastWorkoutDate === today) {
            if (prevWorkoutDate === today - 86400000) {
                data.settings.streak++;
            } else if (!prevWorkoutDate || prevWorkoutDate < today - 86400000) {
                data.settings.streak = 1;
            }
        } else if (lastWorkoutDate < today - 86400000) {
            data.settings.streak = 0;
        }

        data.settings.lastWorkoutDate = data.history[0].date;
        if (data.settings.streak > data.settings.bestStreak) {
            data.settings.bestStreak = data.settings.streak;
        }
    }

    static getWeeklyWorkoutCount() {
        const data = this.load();
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).setHours(0,0,0,0);
        
        return data.history.filter(w => new Date(w.date).getTime() >= startOfWeek).length;
    }
}

// --- App State ---
const state = {
    currentView: 'dashboard',
    activeWorkout: null,
    timerInterval: null,
    startTime: null,
    breakInterval: null,
    breakTime: 0,
    notificationPermission: 'default'
};

// --- UI Components ---
const UI = {
    container: document.getElementById('view-container'),
    navBtns: document.querySelectorAll('.nav-btn'),
    streakCount: document.getElementById('streak-count'),
    modal: document.getElementById('exercise-modal'),

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

        // Goals
        const weeklyCount = Storage.getWeeklyWorkoutCount();
        const goal = data.settings.weeklyGoal || 3;
        document.getElementById('goal-progress').textContent = `${weeklyCount}/${goal}`;
        const percent = Math.min((weeklyCount / goal) * 100, 100);
        document.getElementById('goal-bar').style.width = `${percent}%`;

        document.getElementById('set-goal-btn').onclick = () => {
            const newGoal = prompt("Set your weekly workout goal:", goal);
            if (newGoal) {
                data.settings.weeklyGoal = parseInt(newGoal);
                Storage.save(data);
                this.initDashboard();
            }
        };

        // Quick Start
        const quickList = document.getElementById('quick-start-list');
        ['Pull-ups', 'Push-ups', 'Dips', 'Muscle-ups'].forEach(ex => {
            const card = document.createElement('div');
            card.className = 'quick-start-card glass';
            card.textContent = ex;
            card.onclick = () => {
                this.renderView('workout');
                this.addExerciseByName(ex);
            };
            quickList.appendChild(card);
        });

        this.checkNotifications();
    },

    initHistory() {
        const data = Storage.load();
        const historyList = document.getElementById('history-list');
        
        if (data.history.length === 0) return;

        historyList.innerHTML = '';
        data.history.forEach((workout, idx) => {
            const item = document.createElement('div');
            item.className = 'history-item glass fade-in';
            
            const date = new Date(workout.date).toLocaleDateString(undefined, { 
                weekday: 'short', month: 'short', day: 'numeric' 
            });

            const totalVolume = workout.exercises.reduce((acc, ex) => {
                return acc + ex.sets.reduce((sAcc, s) => sAcc + (s.reps * (s.weight || 0)), 0);
            }, 0);

            item.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <div class="history-date">${date}</div>
                    <button onclick="UI.confirmDelete(${idx})" style="background:none; border:none; color:var(--danger); font-size:0.8rem;">Delete</button>
                </div>
                <div class="history-title">${workout.name || 'Workout'}</div>
                <div class="history-summary">
                    ${workout.exercises.map(ex => `<span class="history-tag">${ex.name}</span>`).join('')}
                </div>
                ${totalVolume > 0 ? `<div style="font-size:0.7rem; color:var(--text-secondary); margin-top:5px;">Total Volume: ${totalVolume}kg</div>` : ''}
            `;
            historyList.appendChild(item);
        });
    },

    confirmDelete(idx) {
        if (confirm("Delete this workout?")) {
            Storage.deleteWorkout(idx);
            this.initHistory();
        }
    },

    initWorkout() {
        const saved = Storage.loadActiveWorkout();
        if (saved && !state.activeWorkout) {
            state.activeWorkout = saved.workout;
            state.startTime = saved.startTime;
            this.resumeWorkout();
        } else if (!state.activeWorkout) {
            this.startNewWorkout();
        } else {
            this.resumeWorkout();
        }
        
        document.getElementById('add-exercise-btn').onclick = () => this.showExercisePicker();
        document.getElementById('finish-workout-btn').onclick = () => this.finishWorkout();
        document.getElementById('start-break-btn').onclick = () => this.startBreak();
        
        this.updateQuote();
    },

    startNewWorkout() {
        state.activeWorkout = {
            date: new Date().toISOString(),
            exercises: []
        };
        state.startTime = Date.now();
        Storage.saveActiveWorkout(state.activeWorkout, state.startTime);
        this.startTimer();
    },

    resumeWorkout() {
        const container = document.getElementById('active-exercises');
        container.innerHTML = '';
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
            
            // Auto-save every 10 seconds
            if (elapsed % 10 === 0) {
                Storage.saveActiveWorkout(state.activeWorkout, state.startTime);
            }
            
            // Change quote every 2 minutes
            if (elapsed > 0 && elapsed % 120 === 0) {
                this.updateQuote();
            }
        }, 1000);
    },

    updateQuote() {
        const quoteEl = document.getElementById('motivation-quote');
        if (quoteEl) {
            const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
            quoteEl.textContent = `"${randomQuote}"`;
        }
    },

    showExercisePicker() {
        const modal = document.getElementById('exercise-modal');
        const list = document.getElementById('modal-exercise-list');
        const closeBtn = document.getElementById('close-modal');
        
        list.innerHTML = '';
        EXERCISES.forEach(name => {
            const item = document.createElement('div');
            item.className = 'modal-item';
            item.textContent = name;
            item.onclick = () => {
                this.addExerciseByName(name);
                this.closeModal();
            };
            list.appendChild(item);
        });

        modal.classList.remove('hidden');
        closeBtn.onclick = () => this.closeModal();
    },

    closeModal() {
        document.getElementById('exercise-modal').classList.add('hidden');
    },

    addExerciseByName(name) {
        const exercise = { name, sets: [{ reps: 0, weight: 0 }] };
        state.activeWorkout.exercises.push(exercise);
        const container = document.getElementById('active-exercises');
        if (container) {
            container.appendChild(this.createExerciseCard(exercise, state.activeWorkout.exercises.length - 1));
        }
    },

    startBreak() {
        const container = document.getElementById('break-timer-container');
        const timerVal = document.getElementById('break-timer-val');
        const skipBtn = document.getElementById('skip-break-btn');
        
        state.breakTime = 90; // Default 90 seconds
        container.classList.remove('hidden');
        this.updateQuote(); // New quote for motivation during break

        if (state.breakInterval) clearInterval(state.breakInterval);
        
        const updateBreakUI = () => {
            const m = Math.floor(state.breakTime / 60).toString().padStart(2, '0');
            const s = (state.breakTime % 60).toString().padStart(2, '0');
            timerVal.textContent = `${m}:${s}`;
        };

        updateBreakUI();

        state.breakInterval = setInterval(() => {
            state.breakTime--;
            updateBreakUI();
            
            if (state.breakTime <= 0) {
                this.stopBreak();
            }
        }, 1000);

        skipBtn.onclick = () => this.stopBreak();
    },

    stopBreak() {
        clearInterval(state.breakInterval);
        document.getElementById('break-timer-container').classList.add('hidden');
        if (this.notificationPermission === 'granted') {
            new Notification("CaliTracker", { body: "Break over! Back to work!" });
        }
    },

    checkNotifications() {
        if (!("Notification" in window)) return;
        
        if (Notification.permission === 'granted') {
            this.notificationPermission = 'granted';
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                this.notificationPermission = permission;
            });
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
    // Nav Event Delegation
    document.querySelector('.glass-nav').addEventListener('click', (e) => {
        const btn = e.target.closest('.nav-btn');
        if (btn) {
            UI.renderView(btn.dataset.view);
        }
    });

    // Global UI exposure for inline handlers
    window.UI = UI;

    // Initial View - Check for active workout
    const saved = Storage.loadActiveWorkout();
    if (saved) {
        UI.renderView('workout');
    } else {
        UI.renderView('dashboard');
    }
});
