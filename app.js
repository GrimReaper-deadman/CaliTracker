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
    user: null,
    currentView: 'dashboard',
    activeWorkout: null,
    timerInterval: null,
    startTime: null,
    breakInterval: null,
    breakTime: 0,
    notificationPermission: 'default',
    units: 'kg'
};

// --- Auth Manager ---
class Auth {
    static async init() {
        // Mocking for now, real Supabase integration would go here
        const savedUser = localStorage.getItem('calitracker_user');
        if (savedUser) {
            state.user = JSON.parse(savedUser);
        }
    }

    static async login(email, password) {
        // Simulate login
        if (email && password) {
            state.user = { email, name: email.split('@')[0], id: 'user_' + Date.now() };
            localStorage.setItem('calitracker_user', JSON.stringify(state.user));
            return { success: true };
        }
        return { success: false, error: 'Invalid credentials' };
    }

    static async signup(name, email, password) {
        // Simulate signup
        state.user = { email, name, id: 'user_' + Date.now() };
        localStorage.setItem('calitracker_user', JSON.stringify(state.user));
        return { success: true };
    }

    static logout() {
        state.user = null;
        localStorage.removeItem('calitracker_user');
        UI.renderView('auth');
    }
}

// --- UI Components ---
const UI = {
    // Dynamic getters to ensure we always get the latest element from the DOM
    get container() { return document.getElementById('view-container'); },
    get navBtns() { return document.querySelectorAll('.nav-btn'); },
    get streakCount() { return document.getElementById('streak-count'); },
    get modal() { return document.getElementById('exercise-modal'); },

    renderView(viewName) {
        try {
            // Auth Guard
            if (!state.user && viewName !== 'auth') {
                viewName = 'auth';
            }

            state.currentView = viewName;
            
            // Update Nav
            this.navBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === viewName);
            });

            // Load Template
            const template = document.getElementById(`tpl-${viewName}`);
            if (!template) throw new Error(`Template tpl-${viewName} not found`);
            
            const container = this.container;
            if (!container) throw new Error("View container not found");
            
            container.innerHTML = '';
            container.appendChild(template.content.cloneNode(true));

            // View Specific Initialization
            if (viewName === 'auth') this.initAuth();
            if (viewName === 'dashboard') this.initDashboard();
            if (viewName === 'workout') this.initWorkout();
            if (viewName === 'history') this.initHistory();
            if (viewName === 'ai-generator') this.initAIGenerator();
            if (viewName === 'progress') this.initProgress();
            if (viewName === 'profile') this.initProfile();
            if (viewName === 'camera') this.initCamera();
        } catch (err) {
            console.error("Render error:", err);
        }
    },

    initAuth() {
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const showSignup = document.getElementById('show-signup');
        const showLogin = document.getElementById('show-login');

        showSignup.onclick = (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
        };

        showLogin.onclick = (e) => {
            e.preventDefault();
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        };

        document.getElementById('login-btn').onclick = async () => {
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            const res = await Auth.login(email, pass);
            if (res.success) this.renderView('dashboard');
            else alert(res.error);
        };

        document.getElementById('signup-btn').onclick = async () => {
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const pass = document.getElementById('signup-password').value;
            const res = await Auth.signup(name, email, pass);
            if (res.success) this.renderView('dashboard');
            else alert(res.error);
        };
    },

    initDashboard() {
        try {
            const data = Storage.load();
            const totalEl = document.getElementById('stat-total');
            const bestEl = document.getElementById('stat-best-streak');
            const streakCountEl = this.streakCount;
            const goalProgEl = document.getElementById('goal-progress');
            const goalBarEl = document.getElementById('goal-bar');
            const setGoalBtn = document.getElementById('set-goal-btn');
            const quickList = document.getElementById('quick-start-list');

            if (totalEl) totalEl.textContent = data.history.length;
            if (bestEl) bestEl.textContent = data.settings.bestStreak || 0;
            if (streakCountEl) streakCountEl.textContent = data.settings.streak || 0;

            // Goals
            const weeklyCount = Storage.getWeeklyWorkoutCount();
            const goal = data.settings.weeklyGoal || 3;
            if (goalProgEl) goalProgEl.textContent = `${weeklyCount}/${goal}`;
            if (goalBarEl) {
                const percent = Math.min((weeklyCount / goal) * 100, 100);
                goalBarEl.style.width = `${percent}%`;
            }

            if (setGoalBtn) {
                setGoalBtn.onclick = () => {
                    const newGoal = prompt("Set your weekly workout goal:", goal);
                    if (newGoal) {
                        data.settings.weeklyGoal = parseInt(newGoal);
                        Storage.save(data);
                        this.initDashboard();
                    }
                };
            }

            // Quick Start
            if (quickList) {
                quickList.innerHTML = '';
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
            }

            this.checkNotifications();
        } catch (err) {
            console.error("Dashboard init error:", err);
        }
    },

    initHistory() {
        try {
            const data = Storage.load();
            const historyList = document.getElementById('history-list');
            
            if (!historyList) return;
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
        } catch (err) {
            console.error("History init error:", err);
        }
    },

    confirmDelete(idx) {
        if (confirm("Delete this workout?")) {
            Storage.deleteWorkout(idx);
            this.initHistory();
        }
    },

    initWorkout() {
        try {
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
            
            const addExBtn = document.getElementById('add-exercise-btn');
            const finishBtn = document.getElementById('finish-workout-btn');
            const breakBtn = document.getElementById('start-break-btn');

            if (addExBtn) addExBtn.onclick = () => this.showExercisePicker();
            if (finishBtn) finishBtn.onclick = () => this.finishWorkout();
            if (breakBtn) breakBtn.onclick = () => this.startBreak();
            
            this.updateQuote();
        } catch (err) {
            console.error("Workout init error:", err);
        }
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
    },

    // --- AI Generator ---
    initAIGenerator() {
        const genBtn = document.getElementById('generate-ai-btn');
        const resultDiv = document.getElementById('ai-result');
        const list = document.getElementById('ai-exercises-list');
        const startBtn = document.getElementById('start-ai-workout');

        genBtn.onclick = () => {
            const level = document.getElementById('ai-level').value;
            const goal = document.getElementById('ai-goal').value;
            
            // Logic to generate routine
            const routine = this.generateRoutine(level, goal);
            
            list.innerHTML = routine.map(ex => `
                <div class="modal-item" style="text-align:left; margin-bottom:5px;">
                    <strong>${ex.name}</strong>: ${ex.sets} sets x ${ex.reps}
                </div>
            `).join('');
            
            resultDiv.classList.remove('hidden');
            state.pendingRoutine = routine;
        };

        startBtn.onclick = () => {
            this.renderView('workout');
            this.startNewWorkout();
            state.activeWorkout.name = "AI " + document.getElementById('ai-goal').value + " Routine";
            state.activeWorkout.exercises = state.pendingRoutine.map(ex => ({
                name: ex.name,
                sets: Array(ex.sets).fill({ reps: 0, weight: 0 })
            }));
            this.resumeWorkout();
        };
    },

    generateRoutine(level, goal) {
        // Mocking sophisticated AI generation logic
        const baseRoutines = {
            beginner: [
                { name: 'Push-ups', sets: 3, reps: '8-12' },
                { name: 'Australian Pull-ups', sets: 3, reps: '8-10' },
                { name: 'Squats', sets: 3, reps: '15' },
                { name: 'Plank', sets: 3, reps: '30s' }
            ],
            intermediate: [
                { name: 'Pull-ups', sets: 4, reps: '8-10' },
                { name: 'Dips', sets: 4, reps: '12' },
                { name: 'L-Sit Hold', sets: 3, reps: '15s' },
                { name: 'Diamond Push-ups', sets: 3, reps: '10' }
            ],
            advanced: [
                { name: 'Muscle-ups', sets: 5, reps: '5' },
                { name: 'Handstand Push-ups', sets: 4, reps: '8' },
                { name: 'Pistol Squats', sets: 3, reps: '10/side' },
                { name: 'Front Lever Negatives', sets: 3, reps: '5' }
            ]
        };
        return baseRoutines[level] || baseRoutines.beginner;
    },

    // --- Progress & Charts ---
    initProgress() {
        const tabs = document.querySelectorAll('.tab-btn');
        const statsView = document.getElementById('progress-stats-view');
        const photosView = document.getElementById('progress-photos-view');

        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                if (tab.dataset.tab === 'stats') {
                    statsView.classList.remove('hidden');
                    photosView.classList.add('hidden');
                    this.renderCharts();
                } else {
                    statsView.classList.add('hidden');
                    photosView.classList.remove('hidden');
                }
            };
        });

        this.renderCharts();
        this.renderPRs();
    },

    renderCharts() {
        const ctx = document.getElementById('volume-chart');
        if (!ctx) return;

        const data = Storage.load();
        const last7 = data.history.slice(0, 7).reverse();
        const labels = last7.map(w => new Date(w.date).toLocaleDateString(undefined, { weekday: 'short' }));
        const volumes = last7.map(w => {
            return w.exercises.reduce((acc, ex) => {
                return acc + ex.sets.reduce((sAcc, s) => sAcc + (s.reps * (s.weight || 1)), 0);
            }, 0);
        });

        if (state.chart) state.chart.destroy();
        
        state.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Workout Volume',
                    data: volumes,
                    borderColor: '#39ff14',
                    backgroundColor: 'rgba(57, 255, 20, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { display: false },
                    x: { grid: { display: false }, ticks: { color: '#a0a0a0' } }
                }
            }
        });
    },

    renderPRs() {
        const data = Storage.load();
        const prItems = document.getElementById('pr-items');
        if (!prItems) return;

        const prs = {};
        data.history.forEach(w => {
            w.exercises.forEach(ex => {
                const maxReps = Math.max(...ex.sets.map(s => s.reps));
                if (!prs[ex.name] || maxReps > prs[ex.name]) {
                    prs[ex.name] = maxReps;
                }
            });
        });

        prItems.innerHTML = Object.entries(prs).map(([name, val]) => `
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span>${name}</span>
                <span style="color:var(--accent-color); font-weight:800;">${val} Reps</span>
            </div>
        `).join('') || '<div class="text-secondary text-center">No PRs yet</div>';
    },

    // --- Camera & AI Feedback ---
    initCamera() {
        const video = document.getElementById('camera-feed');
        const closeBtn = document.getElementById('close-camera');
        const captureBtn = document.getElementById('capture-btn');
        const togglePose = document.getElementById('toggle-pose');
        const feedback = document.getElementById('pose-feedback');

        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
            .then(stream => {
                video.srcObject = stream;
                state.cameraStream = stream;
            })
            .catch(err => {
                alert("Camera access denied");
                this.renderView('progress');
            });

        closeBtn.onclick = () => {
            if (state.cameraStream) {
                state.cameraStream.getTracks().forEach(track => track.stop());
            }
            this.renderView('progress');
        };

        togglePose.onclick = () => {
            feedback.classList.toggle('hidden');
            if (!feedback.classList.contains('hidden')) {
                feedback.innerHTML = '<p>Form Analysis: <strong>Straight Back Detected</strong></p>';
            }
        };

        captureBtn.onclick = () => {
            alert("Photo saved to gallery (simulated)");
            closeBtn.click();
        };
    },

    // --- Profile ---
    initProfile() {
        const nameDisplay = document.getElementById('user-name-display');
        const emailDisplay = document.getElementById('user-email-display');
        const logoutBtn = document.getElementById('logout-btn');

        if (state.user) {
            nameDisplay.textContent = state.user.name;
            emailDisplay.textContent = state.user.email;
        }

        logoutBtn.onclick = () => Auth.logout();
    }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await Auth.init();

        const nav = document.querySelector('.glass-nav');
        if (nav) {
            nav.addEventListener('click', (e) => {
                const btn = e.target.closest('.nav-btn');
                if (btn) {
                    UI.renderView(btn.dataset.view);
                }
            });
        }

        // Global UI exposure for inline handlers
        window.UI = UI;
        window.showToast = (msg) => {
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        };

        // Initial View - Check for active workout
        const saved = Storage.loadActiveWorkout();
        if (saved) {
            UI.renderView('workout');
        } else {
            UI.renderView('dashboard');
        }
    } catch (err) {
        console.error("Critical Init Error:", err);
    }
});
