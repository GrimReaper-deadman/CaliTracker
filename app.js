/**
 * CaliTracker - Core Logic (Robust Version)
 */

// --- Constants & Data ---
const EXERCISES = [
    'Pull-ups', 'Push-ups', 'Dips', 'Squats', 'Muscle-ups', 
    'Chin-ups', 'Plank (sec)', 'Handstand (sec)', 'Leg Raises'
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

// --- App State ---
const state = {
    user: null,
    currentView: 'dashboard',
    activeWorkout: null,
    timerInterval: null,
    startTime: null,
    elapsedTime: 0,
    isPaused: false,
    breakInterval: null,
    breakTime: 0,
    notificationPermission: 'default',
    units: 'kg',
    chart: null,
    pendingRoutine: null
};

// --- Storage Manager ---
class Storage {
    static KEY = 'calitracker_data';
    static ACTIVE_KEY = 'calitracker_active';

    static load() {
        try {
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
            if (!data) return defaults;
            const parsed = JSON.parse(data);
            return { ...defaults, ...parsed, settings: { ...defaults.settings, ...(parsed.settings || {}) } };
        } catch (e) {
            console.error("Storage load error:", e);
            return { history: [], settings: { streak: 0, bestStreak: 0, weeklyGoal: 3 } };
        }
    }

    static save(data) {
        localStorage.setItem(this.KEY, JSON.stringify(data));
    }

    static saveActiveWorkout(workout, startTime, elapsedTime = 0) {
        localStorage.setItem(this.ACTIVE_KEY, JSON.stringify({ workout, startTime, elapsedTime }));
    }

    static loadActiveWorkout() {
        try {
            const data = localStorage.getItem(this.ACTIVE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) { return null; }
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
            const oneDay = 86400000;
            if (prevWorkoutDate === today - oneDay) {
                data.settings.streak++;
            } else if (!prevWorkoutDate || prevWorkoutDate < today - oneDay) {
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

// --- Auth Manager ---
class Auth {
    static async init() {
        const savedUser = localStorage.getItem('calitracker_user');
        if (savedUser) {
            try {
                state.user = JSON.parse(savedUser);
            } catch (e) { state.user = null; }
        }
    }

    static async login(email, password) {
        await new Promise(r => setTimeout(r, 800));
        if (email && password) {
            if (password.length < 4) return { success: false, error: 'Password too short' };
            state.user = { email, name: email.split('@')[0], id: 'user_' + Date.now() };
            localStorage.setItem('calitracker_user', JSON.stringify(state.user));
            return { success: true };
        }
        return { success: false, error: 'Please enter email and password' };
    }

    static async signup(name, email, password) {
        await new Promise(r => setTimeout(r, 1000));
        if (name && email && password) {
            if (password.length < 4) return { success: false, error: 'Password too short' };
            state.user = { email, name, id: 'user_' + Date.now() };
            localStorage.setItem('calitracker_user', JSON.stringify(state.user));
            return { success: true };
        }
        return { success: false, error: 'All fields are required' };
    }

    static async updateProfile(name, email) {
        await new Promise(r => setTimeout(r, 500));
        if (state.user) {
            state.user.name = name || state.user.name;
            state.user.email = email || state.user.email;
            localStorage.setItem('calitracker_user', JSON.stringify(state.user));
            return { success: true };
        }
        return { success: false };
    }

    static logout() {
        state.user = null;
        localStorage.removeItem('calitracker_user');
        UI.renderView('auth');
    }
}

// --- Utils ---
const Utils = {
    setLoading(btnId, isLoading) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        if (isLoading) {
            btn.dataset.originalText = btn.textContent;
            btn.innerHTML = '<div class="spinner" style="margin: 0 auto;"></div>';
            btn.disabled = true;
        } else {
            btn.textContent = btn.dataset.originalText;
            btn.disabled = false;
        }
    },
    showToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
};

// --- UI Components ---
const UI = {
    get container() { return document.getElementById('view-container'); },
    get navBtns() { return document.querySelectorAll('.nav-btn'); },

    renderView(viewName) {
        console.log("Rendering view:", viewName);
        try {
            if (!state.user && viewName !== 'auth') {
                viewName = 'auth';
            }

            state.currentView = viewName;
            
            this.navBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === viewName);
            });

            const template = document.getElementById(`tpl-${viewName}`);
            if (!template) throw new Error(`Template tpl-${viewName} not found`);
            
            const container = this.container;
            if (!container) return;
            
            container.innerHTML = '';
            container.appendChild(template.content.cloneNode(true));

            // Initialize view-specific logic
            const initFunc = `init${viewName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}`;
            console.log("Calling init function:", initFunc);
            if (this[initFunc]) this[initFunc]();

            // Refresh global elements
            this.updateGlobalElements();
        } catch (err) {
            console.error("Render error:", err);
        }
    },

    updateGlobalElements() {
        const data = Storage.load();
        const streakEl = document.getElementById('streak-count');
        if (streakEl) streakEl.textContent = data.settings.streak || 0;
    },

    initAuth() {
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');

        // Toggle logic
        const showSignup = document.getElementById('show-signup');
        const showLogin = document.getElementById('show-login');
        if (showSignup) showSignup.onclick = (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
        };
        if (showLogin) showLogin.onclick = (e) => {
            e.preventDefault();
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        };

        // Actions
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) loginBtn.onclick = async () => {
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            Utils.setLoading('login-btn', true);
            const res = await Auth.login(email, pass);
            Utils.setLoading('login-btn', false);
            if (res.success) { Utils.showToast("Welcome back!"); UI.renderView('dashboard'); }
            else alert(res.error);
        };

        const signupBtn = document.getElementById('signup-btn');
        if (signupBtn) signupBtn.onclick = async () => {
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const pass = document.getElementById('signup-password').value;
            Utils.setLoading('signup-btn', true);
            const res = await Auth.signup(name, email, pass);
            Utils.setLoading('signup-btn', false);
            if (res.success) { Utils.showToast("Account created!"); UI.renderView('dashboard'); }
            else alert(res.error);
        };
    },

    initDashboard() {
        const data = Storage.load();
        const totalEl = document.getElementById('stat-total');
        const bestEl = document.getElementById('stat-best-streak');
        const goalProgEl = document.getElementById('goal-progress');
        const goalBarEl = document.getElementById('goal-bar');
        const setGoalBtn = document.getElementById('set-goal-btn');
        const quickList = document.getElementById('quick-start-list');

        if (totalEl) totalEl.textContent = data.history.length;
        if (bestEl) bestEl.textContent = data.settings.bestStreak || 0;

        const weeklyCount = Storage.getWeeklyWorkoutCount();
        const goal = data.settings.weeklyGoal || 3;
        if (goalProgEl) goalProgEl.textContent = `${weeklyCount}/${goal}`;
        if (goalBarEl) goalBarEl.style.width = `${Math.min((weeklyCount / goal) * 100, 100)}%`;

        if (setGoalBtn) setGoalBtn.onclick = () => {
            const newGoal = prompt("Weekly goal (1-7):", goal);
            const parsed = parseInt(newGoal);
            if (parsed >= 1 && parsed <= 7) {
                data.settings.weeklyGoal = parsed;
                Storage.save(data);
                Utils.showToast("Goal updated!");
                this.initDashboard();
            }
        };

        if (quickList) {
            quickList.innerHTML = '';
            ['Pull-ups', 'Push-ups', 'Dips', 'Muscle-ups'].forEach(ex => {
                const card = document.createElement('div');
                card.className = 'quick-start-card glass';
                card.textContent = ex;
                card.onclick = () => { this.renderView('workout'); this.addExerciseByName(ex); };
                quickList.appendChild(card);
            });
        }
    },

    initHistory() {
        const data = Storage.load();
        const historyList = document.getElementById('history-list');
        if (!historyList) return;
        if (data.history.length === 0) return;

        historyList.innerHTML = '';
        data.history.forEach((workout, idx) => {
            const item = document.createElement('div');
            item.className = 'history-item glass fade-in';
            const date = new Date(workout.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <div class="history-date">${date}</div>
                    <button class="delete-workout-btn" data-idx="${idx}" style="background:none; border:none; color:var(--danger); font-size:0.8rem;">Delete</button>
                </div>
                <div class="history-title">${workout.name || 'Workout'}</div>
                <div class="history-summary">${workout.exercises.map(ex => `<span class="history-tag">${ex.name}</span>`).join('')}</div>
            `;
            historyList.appendChild(item);
        });

        historyList.onclick = (e) => {
            if (e.target.classList.contains('delete-workout-btn')) {
                const idx = e.target.dataset.idx;
                if (confirm("Delete this workout?")) {
                    Storage.deleteWorkout(idx);
                    Utils.showToast("Deleted");
                    this.initHistory();
                }
            }
        };
    },

    initStreak() {
        const data = Storage.load();
        const currentVal = document.getElementById('current-streak-val');
        const bestVal = document.getElementById('streak-best-val');
        const lastVal = document.getElementById('streak-last-val');
        const calendar = document.getElementById('activity-calendar');

        if (currentVal) currentVal.textContent = data.settings.streak || 0;
        if (bestVal) bestVal.textContent = data.settings.bestStreak || 0;
        if (lastVal) lastVal.textContent = data.settings.lastWorkoutDate ? new Date(data.settings.lastWorkoutDate).toLocaleDateString() : 'None';

        if (calendar) {
            calendar.innerHTML = '';
            const today = new Date();
            for (let i = 29; i >= 0; i--) {
                const d = new Date(today); d.setDate(d.getDate() - i);
                const hasWorkout = data.history.some(w => new Date(w.date).toDateString() === d.toDateString());
                const dot = document.createElement('div');
                dot.style.aspectRatio = '1'; dot.style.borderRadius = '4px';
                dot.style.background = hasWorkout ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)';
                calendar.appendChild(dot);
            }
        }
    },

    initWorkout() {
        const saved = Storage.loadActiveWorkout();
        if (saved && !state.activeWorkout) {
            state.activeWorkout = saved.workout;
            // Timer reset on app load as per requirements
            state.startTime = Date.now();
            state.elapsedTime = 0;
            state.isPaused = false;
            this.resumeWorkout();
        } else if (!state.activeWorkout) {
            this.startNewWorkout();
        } else {
            this.resumeWorkout();
        }
        
        const addExBtn = document.getElementById('add-exercise-btn');
        const finishBtn = document.getElementById('finish-workout-btn');
        const breakBtn = document.getElementById('start-break-btn');
        const saveBtn = document.getElementById('save-workout-btn');
        
        // Timer controls
        const pauseBtn = document.getElementById('pause-timer-btn');
        const resumeBtn = document.getElementById('resume-timer-btn');
        const resetBtn = document.getElementById('reset-timer-btn');

        if (addExBtn) addExBtn.onclick = () => this.showExercisePicker();
        if (finishBtn) finishBtn.onclick = () => this.finishWorkout();
        if (breakBtn) breakBtn.onclick = () => this.startBreak();
        if (saveBtn) saveBtn.onclick = () => { Storage.saveActiveWorkout(state.activeWorkout, state.startTime, state.elapsedTime); Utils.showToast("Saved"); };
        
        if (pauseBtn) pauseBtn.onclick = () => this.pauseTimer();
        if (resumeBtn) resumeBtn.onclick = () => this.resumeTimer();
        if (resetBtn) resetBtn.onclick = () => this.resetTimer();

        this.updateTimerUI();
    },

    startNewWorkout() {
        state.activeWorkout = { date: new Date().toISOString(), exercises: [] };
        state.startTime = Date.now();
        state.elapsedTime = 0;
        state.isPaused = false;
        Storage.saveActiveWorkout(state.activeWorkout, state.startTime, state.elapsedTime);
        this.startTimer();
    },

    resumeWorkout() {
        const container = document.getElementById('active-exercises');
        if (container) {
            container.innerHTML = '';
            state.activeWorkout.exercises.forEach((ex, idx) => container.appendChild(this.createExerciseCard(ex, idx)));
        }
        this.startTimer();
    },

    startTimer() {
        if (state.timerInterval) clearInterval(state.timerInterval);
        if (state.isPaused) return;

        state.timerInterval = setInterval(() => {
            const timerEl = document.getElementById('workout-timer');
            const now = Date.now();
            const totalElapsedMs = state.elapsedTime + (now - state.startTime);
            const totalSeconds = Math.floor(totalElapsedMs / 1000);
            
            const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
            const s = (totalSeconds % 60).toString().padStart(2, '0');
            if (timerEl) timerEl.textContent = `${m}:${s}`;
        }, 1000);
    },

    pauseTimer() {
        if (state.isPaused) return;
        clearInterval(state.timerInterval);
        state.elapsedTime += (Date.now() - state.startTime);
        state.isPaused = true;
        this.updateTimerUI();
    },

    resumeTimer() {
        if (!state.isPaused) return;
        state.startTime = Date.now();
        state.isPaused = false;
        this.startTimer();
        this.updateTimerUI();
    },

    resetTimer() {
        clearInterval(state.timerInterval);
        state.startTime = Date.now();
        state.elapsedTime = 0;
        state.isPaused = false;
        const timerEl = document.getElementById('workout-timer');
        if (timerEl) timerEl.textContent = '00:00';
        this.startTimer();
        this.updateTimerUI();
    },

    updateTimerUI() {
        const pauseBtn = document.getElementById('pause-timer-btn');
        const resumeBtn = document.getElementById('resume-timer-btn');
        if (pauseBtn && resumeBtn) {
            pauseBtn.classList.toggle('hidden', state.isPaused);
            resumeBtn.classList.toggle('hidden', !state.isPaused);
        }
    },

    showExercisePicker() {
        const modal = document.getElementById('exercise-modal');
        const list = document.getElementById('modal-exercise-list');
        const closeBtn = document.getElementById('close-modal');
        if (!modal || !list) return;
        
        list.innerHTML = '';
        EXERCISES.forEach(name => {
            const item = document.createElement('div');
            item.className = 'modal-item';
            item.textContent = name;
            item.onclick = () => { this.addExerciseByName(name); modal.classList.add('hidden'); };
            list.appendChild(item);
        });
        modal.classList.remove('hidden');
        closeBtn.onclick = () => modal.classList.add('hidden');
    },

    addExerciseByName(name) {
        const exercise = { name, sets: [{ reps: 0, weight: 0 }] };
        state.activeWorkout.exercises.push(exercise);
        const container = document.getElementById('active-exercises');
        if (container) container.appendChild(this.createExerciseCard(exercise, state.activeWorkout.exercises.length - 1));
    },

    createExerciseCard(exercise, exIdx) {
        const card = document.createElement('div');
        card.className = 'exercise-card glass fade-in';
        card.innerHTML = `
            <div class="exercise-title"><span>${exercise.name}</span></div>
            <div class="sets-container" id="sets-ex-${exIdx}"></div>
            <button class="add-set-btn" onclick="UI.addSet(${exIdx})">+ Add Set</button>
        `;
        const setsContainer = card.querySelector('.sets-container');
        exercise.sets.forEach((set, setIdx) => setsContainer.appendChild(this.createSetRow(exIdx, setIdx, set)));
        return card;
    },

    createSetRow(exIdx, setIdx, set) {
        const row = document.createElement('div');
        row.className = 'set-row';
        row.innerHTML = `
            <span class="set-num">${setIdx + 1}</span>
            <input type="number" placeholder="Reps" value="${set.reps || ''}" data-ex="${exIdx}" data-set="${setIdx}" data-field="reps">
            <input type="number" placeholder="Kg" value="${set.weight || ''}" data-ex="${exIdx}" data-set="${setIdx}" data-field="weight">
            <button class="remove-set" onclick="UI.removeSet(${exIdx}, ${setIdx})">×</button>
        `;
        row.querySelectorAll('input').forEach(input => {
            input.onchange = (e) => { state.activeWorkout.exercises[exIdx].sets[setIdx][e.target.dataset.field] = parseInt(e.target.value) || 0; };
        });
        return row;
    },

    addSet(exIdx) {
        const exercise = state.activeWorkout.exercises[exIdx];
        const newSet = { reps: 0, weight: 0 };
        exercise.sets.push(newSet);
        const container = document.getElementById(`sets-ex-${exIdx}`);
        if (container) container.appendChild(this.createSetRow(exIdx, exercise.sets.length - 1, newSet));
    },

    removeSet(exIdx, setIdx) {
        state.activeWorkout.exercises[exIdx].sets.splice(setIdx, 1);
        this.resumeWorkout();
    },

    finishWorkout() {
        if (!state.activeWorkout.exercises.some(ex => ex.sets.some(s => s.reps > 0))) {
            alert("Log at least one set!"); return;
        }
        Storage.addWorkout(state.activeWorkout);
        state.activeWorkout = null;
        clearInterval(state.timerInterval);
        Utils.showToast("Great job!");
        this.renderView('dashboard');
    },

    startBreak() {
        const container = document.getElementById('break-timer-container');
        const timerVal = document.getElementById('break-timer-val');
        if (!container) return;
        state.breakTime = 90;
        container.classList.remove('hidden');
        if (state.breakInterval) clearInterval(state.breakInterval);
        state.breakInterval = setInterval(() => {
            state.breakTime--;
            const m = Math.floor(state.breakTime / 60).toString().padStart(2, '0');
            const s = (state.breakTime % 60).toString().padStart(2, '0');
            if (timerVal) timerVal.textContent = `${m}:${s}`;
            if (state.breakTime <= 0) { clearInterval(state.breakInterval); container.classList.add('hidden'); }
        }, 1000);
        const skipBtn = document.getElementById('skip-break-btn');
        if (skipBtn) skipBtn.onclick = () => { clearInterval(state.breakInterval); container.classList.add('hidden'); };
    },

    initAiGenerator() {
        const genBtn = document.getElementById('generate-ai-btn');
        const resultDiv = document.getElementById('ai-result');
        const list = document.getElementById('ai-exercises-list');
        const startBtn = document.getElementById('start-ai-workout');
        if (!genBtn) return;

        genBtn.onclick = async () => {
            Utils.setLoading('generate-ai-btn', true);
            resultDiv.classList.add('hidden');
            await new Promise(r => setTimeout(r, 1500));
            const level = document.getElementById('ai-level').value;
            const goal = document.getElementById('ai-goal').value;
            const routine = this.generateRoutine(level, goal);
            list.innerHTML = routine.map(ex => `<div class="modal-item" style="text-align:left;"><strong>${ex.name}</strong>: ${ex.sets}x${ex.reps}</div>`).join('');
            Utils.setLoading('generate-ai-btn', false);
            resultDiv.classList.remove('hidden');
            state.pendingRoutine = routine;
        };

        startBtn.onclick = () => {
            this.renderView('workout');
            this.startNewWorkout();
            state.activeWorkout.exercises = state.pendingRoutine.map(ex => ({ name: ex.name, sets: Array(ex.sets).fill(null).map(() => ({ reps: 0, weight: 0 })) }));
            this.resumeWorkout();
        };
    },

    generateRoutine(level, goal) {
        const base = {
            beginner: [{ name: 'Push-ups', sets: 3, reps: '10' }, { name: 'Squats', sets: 3, reps: '15' }],
            intermediate: [{ name: 'Pull-ups', sets: 4, reps: '8' }, { name: 'Dips', sets: 4, reps: '10' }],
            advanced: [{ name: 'Muscle-ups', sets: 5, reps: '5' }, { name: 'HSPU', sets: 4, reps: '8' }]
        };
        return base[level] || base.beginner;
    },

    initProgress() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('progress-stats-view').classList.toggle('hidden', tab.dataset.tab !== 'stats');
                document.getElementById('progress-photos-view').classList.toggle('hidden', tab.dataset.tab !== 'photos');
                if (tab.dataset.tab === 'stats') this.renderCharts(); else this.renderPhotos();
            };
        });
        this.renderCharts();
    },

    renderCharts() {
        const ctx = document.getElementById('volume-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        const data = Storage.load();
        const last7 = data.history.slice(0, 7).reverse();
        if (state.chart) state.chart.destroy();
        
        const getVolume = (w) => w.exercises.reduce((acc, ex) => acc + ex.sets.reduce((sacc, set) => sacc + (set.reps || 0) * (set.weight || 1), 0), 0);

        state.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last7.map(w => new Date(w.date).toLocaleDateString(undefined, { weekday: 'short' })),
                datasets: [{ label: 'Volume', data: last7.map(w => getVolume(w)), borderColor: '#39ff14', tension: 0.4, backgroundColor: 'rgba(57, 255, 20, 0.1)', fill: true }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    },

    renderPhotos() {
        const gallery = document.getElementById('photo-gallery');
        const photos = JSON.parse(localStorage.getItem('calitracker_photos') || '[]');
        gallery.innerHTML = '<div class="add-photo-card glass" onclick="UI.renderView(\'camera\')"><span>Take Photo</span></div>';
        photos.forEach(p => {
            const div = document.createElement('div');
            div.className = 'photo-card glass'; div.style.backgroundImage = `url(${p.url})`;
            gallery.appendChild(div);
        });
    },

    initCamera() {
        const video = document.getElementById('camera-feed');
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
                .then(s => { video.srcObject = s; state.cameraStream = s; })
                .catch(err => { Utils.showToast("Camera Error: " + err.message); this.renderView('progress'); });
        } else {
            Utils.showToast("Camera API not supported or secure context required");
            this.renderView('progress');
        }
        
        document.getElementById('capture-btn').onclick = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const photos = JSON.parse(localStorage.getItem('calitracker_photos') || '[]');
            photos.unshift({ url: canvas.toDataURL() });
            localStorage.setItem('calitracker_photos', JSON.stringify(photos));
            this.stopCamera(); this.renderView('progress');
        };
        document.getElementById('close-camera').onclick = () => { this.stopCamera(); this.renderView('progress'); };
        
        const togglePoseBtn = document.getElementById('toggle-pose');
        const poseFeedback = document.getElementById('pose-feedback');
        if (togglePoseBtn && poseFeedback) {
            togglePoseBtn.onclick = () => {
                const isHidden = poseFeedback.classList.contains('hidden');
                if (isHidden) {
                    poseFeedback.classList.remove('hidden');
                    Utils.showToast("Pose tracking enabled");
                    this.startPoseTracking();
                } else {
                    poseFeedback.classList.add('hidden');
                    Utils.showToast("Pose tracking disabled");
                    this.stopPoseTracking();
                }
            };
        }
    },

    startPoseTracking() {
        const canvas = document.getElementById('pose-canvas');
        if (!canvas) return;
        // Match canvas size to video size
        const video = document.getElementById('camera-feed');
        if (video) {
            canvas.width = video.clientWidth;
            canvas.height = video.clientHeight;
        }
        const ctx = canvas.getContext('2d');
        let x = 0;
        state.poseInterval = setInterval(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#39ff14';
            ctx.lineWidth = 3;
            ctx.beginPath();
            // Draw a simple tracking box/circle
            ctx.arc(canvas.width / 2 + Math.sin(x) * 50, canvas.height / 2 + Math.cos(x) * 50, 40, 0, 2 * Math.PI);
            ctx.stroke();
            x += 0.1;
        }, 50);
    },

    stopPoseTracking() {
        if (state.poseInterval) clearInterval(state.poseInterval);
        const canvas = document.getElementById('pose-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    },

    stopCamera() {
        if (state.cameraStream) state.cameraStream.getTracks().forEach(t => t.stop());
        this.stopPoseTracking();
    },

    initProfile() {
        const data = Storage.load();
        const nameEl = document.getElementById('user-name-display');
        const emailEl = document.getElementById('user-email-display');
        const logoutBtn = document.getElementById('logout-btn');
        const accountBtn = document.getElementById('account-settings-btn');

        if (nameEl) nameEl.textContent = state.user ? state.user.name : 'Guest User';
        if (emailEl) emailEl.textContent = state.user ? state.user.email : 'Sign in to sync data';
        
        if (logoutBtn) logoutBtn.onclick = () => Auth.logout();
        if (accountBtn) accountBtn.onclick = () => Utils.showToast("Cloud sync coming soon!");

        const unitSelect = document.getElementById('unit-select');
        if (unitSelect) {
            unitSelect.value = state.units;
            unitSelect.onchange = (e) => { state.units = e.target.value; Utils.showToast("Units updated"); };
        }
    }
};

// --- Global Exposure ---
window.UI = UI;
window.Utils = Utils;

// --- Global Event Delegation ---
document.addEventListener('click', (e) => {
    const target = e.target;
    
    // View switching
    const viewBtn = target.closest('[data-view]');
    if (viewBtn) {
        UI.renderView(viewBtn.dataset.view);
        return;
    }

    // Streak badge specific
    const streakBadge = target.closest('#streak-badge');
    if (streakBadge) {
        UI.renderView('streak');
        return;
    }
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    const saved = Storage.loadActiveWorkout();
    UI.renderView(saved ? 'workout' : 'dashboard');
});
