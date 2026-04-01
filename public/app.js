// ============================================================
// KONFIGURATION — Hier einfach anpassen!
// ============================================================
const CONFIG = {
    currency: 'EUR',
    locale: 'de-DE',

    // Belohnungsstufen — Die Stufen gelten AB dem jeweiligen Gesamtumsatz
    tiers: [
        {
            name: 'Bronze',
            icon: '🥉',
            threshold: 6000,
            bonus: 120,
            color: '#cd7f32',
            colorLight: '#f5e6d0'
        },
        {
            name: 'Silber',
            icon: '🥈',
            threshold: 8000,
            bonus: 400,
            color: '#9ca3af',
            colorLight: '#e8eaed'
        },
        {
            name: 'Gold',
            icon: '🥇',
            threshold: 12000,
            bonus: 1000,
            color: '#eab308',
            colorLight: '#fef9c3'
        },
        {
            name: 'Diamant',
            icon: '💎',
            threshold: 20000,
            bonus: 2400,
            color: '#06b6d4',
            colorLight: '#cffafe'
        }
    ]
};


// ============================================================
// API-LAYER (ersetzt localStorage)
// ============================================================
const API = {
    async getEntries() {
        const res = await fetch('/api/entries');
        return res.json();
    },
    async createEntry(data) {
        const res = await fetch('/api/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async updateEntry(id, data) {
        const res = await fetch(`/api/entries/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async deleteEntry(id) {
        await fetch(`/api/entries/${id}`, { method: 'DELETE' });
    },
    async getTimeEntries() {
        const res = await fetch('/api/time-entries');
        return res.json();
    },
    async createTimeEntry(data) {
        const res = await fetch('/api/time-entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async updateTimeEntry(id, data) {
        const res = await fetch(`/api/time-entries/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async deleteTimeEntry(id) {
        await fetch(`/api/time-entries/${id}`, { method: 'DELETE' });
    },
    async exportData() {
        const res = await fetch('/api/export');
        return res.json();
    },
    async importData(data) {
        const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async resetData() {
        await fetch('/api/reset', { method: 'DELETE' });
    }
};


// ============================================================
// HILFSFUNKTIONEN
// ============================================================
function formatCurrency(amount) {
    return new Intl.NumberFormat(CONFIG.locale, {
        style: 'currency',
        currency: CONFIG.currency
    }).format(amount);
}

function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(CONFIG.locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getWeekday(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(CONFIG.locale, { weekday: 'short' });
}

function getMonthLabel(yearMonth) {
    const [y, m] = yearMonth.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
    return d.toLocaleDateString(CONFIG.locale, { month: 'long', year: 'numeric' });
}

function getCurrentYearMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}


// ============================================================
// STATE
// ============================================================
let currentMonth = getCurrentYearMonth();
let revenueEntries = [];
let timeEntries = [];

function getEntriesForMonth(yearMonth) {
    return revenueEntries
        .filter(e => e.date.startsWith(yearMonth))
        .sort((a, b) => a.date.localeCompare(b.date));
}

function getTimeEntriesForMonth(yearMonth) {
    return timeEntries
        .filter(e => e.date.startsWith(yearMonth))
        .sort((a, b) => a.date.localeCompare(b.date));
}

function getMonthlyTotal(yearMonth) {
    return getEntriesForMonth(yearMonth).reduce((sum, e) => sum + e.amount, 0);
}


// ============================================================
// BELOHNUNGSSYSTEM
// ============================================================
function getCurrentTier(total) {
    for (let i = CONFIG.tiers.length - 1; i >= 0; i--) {
        if (total >= CONFIG.tiers[i].threshold) return CONFIG.tiers[i];
    }
    return null;
}

function getNextTier(total) {
    for (const tier of CONFIG.tiers) {
        if (total < tier.threshold) return tier;
    }
    return null;
}

function getTierIndex(tier) {
    if (!tier) return -1;
    return CONFIG.tiers.findIndex(t => t.name === tier.name);
}

function getOverallProgress(total) {
    const maxThreshold = CONFIG.tiers[CONFIG.tiers.length - 1].threshold;
    return Math.min((total / maxThreshold) * 100, 100);
}

function calculateRewards(total) {
    const tier = getCurrentTier(total);
    if (!tier) return { bonus: 0, totalReward: 0 };
    return { bonus: tier.bonus, totalReward: tier.bonus };
}

function getMotivationText(total) {
    if (total === 0) return 'Trage deinen ersten Umsatz ein! 💪';
    const tier = getCurrentTier(total);
    const nextTier = getNextTier(total);
    if (!tier) return `Noch ${formatCurrency(CONFIG.tiers[0].threshold - total)} bis Bronze!`;
    if (!nextTier) return 'Unglaublich! Du hast die höchste Stufe erreicht! 🎉🏆';
    const remaining = nextTier.threshold - total;
    return `Noch ${formatCurrency(remaining)} bis ${nextTier.icon} ${nextTier.name}!`;
}


// ============================================================
// TAB NAVIGATION
// ============================================================
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${target}`).classList.add('active');
        if (target === 'statistics') renderStatistics();
    });
});


// ============================================================
// MONTH PICKER
// ============================================================
const monthLabel = document.getElementById('currentMonthLabel');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');

function changeMonth(delta) {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    renderAll();
}

prevMonthBtn.addEventListener('click', () => changeMonth(-1));
nextMonthBtn.addEventListener('click', () => changeMonth(1));


// ============================================================
// RENDERING
// ============================================================
function renderAll() {
    monthLabel.textContent = getMonthLabel(currentMonth);
    const total = getMonthlyTotal(currentMonth);
    document.getElementById('headerTotal').textContent = formatCurrency(total);
    document.getElementById('timesheetCard').setAttribute('data-month', getMonthLabel(currentMonth));
    renderDashboard(total);
    renderEntries();
    renderTimesheet();
}

function renderDashboard(total) {
    const tier = getCurrentTier(total);
    const nextTier = getNextTier(total);
    const rewards = calculateRewards(total);

    const tierCard = document.getElementById('tierCard');
    tierCard.className = 'card tier-card';
    if (tier) tierCard.classList.add(`tier-${tier.name.toLowerCase()}`);

    document.getElementById('tierIcon').textContent = tier ? tier.icon : '🎯';
    document.getElementById('tierName').textContent = tier ? tier.name : 'Noch keine Stufe';
    document.getElementById('tierMotivation').textContent = getMotivationText(total);

    const progressPercent = getOverallProgress(total);
    const progressFill = document.getElementById('progressFill');
    const progressPulse = document.getElementById('progressPulse');

    progressFill.style.width = `${progressPercent}%`;
    if (tier) progressFill.style.background = `linear-gradient(90deg, ${tier.color}, ${tier.colorLight})`;
    progressPulse.style.left = `calc(${progressPercent}% - 7px)`;

    const markersContainer = document.getElementById('progressMarkers');
    const maxThreshold = CONFIG.tiers[CONFIG.tiers.length - 1].threshold;
    markersContainer.innerHTML = '';
    markersContainer.style.position = 'relative';
    markersContainer.style.height = '22px';

    CONFIG.tiers.forEach(t => {
        const marker = document.createElement('div');
        marker.className = `progress-marker${total >= t.threshold ? ' reached' : ''}`;
        marker.style.position = 'absolute';
        marker.style.left = `${(t.threshold / maxThreshold) * 100}%`;
        marker.style.transform = 'translateX(-50%)';
        marker.innerHTML = `<span>${t.icon} ${(t.threshold / 1000)}k</span>`;
        markersContainer.appendChild(marker);
    });

    document.getElementById('progressCurrent').textContent = formatCurrency(total);
    if (nextTier) {
        document.getElementById('progressNext').textContent = `Nächstes Ziel: ${formatCurrency(nextTier.threshold)}`;
    } else if (tier) {
        document.getElementById('progressNext').textContent = '🏆 Maximum erreicht!';
    } else {
        document.getElementById('progressNext').textContent = `Nächstes Ziel: ${formatCurrency(CONFIG.tiers[0].threshold)}`;
    }

    document.getElementById('rewardBonus').textContent = formatCurrency(rewards.bonus);
    document.getElementById('rewardTotal').textContent = formatCurrency(rewards.totalReward);

    renderTierOverview(total);
    renderMiniChart();
}

function renderTierOverview(total) {
    const currentTier = getCurrentTier(total);
    document.getElementById('tierInfoBase').hidden = true;

    const container = document.getElementById('tierOverview');
    container.innerHTML = CONFIG.tiers.map(tier => {
        const isReached = total >= tier.threshold;
        const isCurrent = currentTier && currentTier.name === tier.name;
        let cls = 'tier-overview-item';
        if (isCurrent) cls += ' current';
        else if (isReached) cls += ' reached';
        else cls += ' locked';

        return `
            <div class="${cls}" style="${isCurrent ? `border-color: ${tier.color}; background: ${tier.colorLight}40` : ''}">
                <span class="tier-overview-icon">${tier.icon}</span>
                <div class="tier-overview-info">
                    <div class="tier-overview-name">
                        ${tier.name}
                        ${isCurrent ? '<span class="tier-badge-current">Aktuell</span>' : ''}
                        ${isReached && !isCurrent ? '<span class="tier-checkmark">✓</span>' : ''}
                    </div>
                    <div class="tier-overview-threshold">ab ${formatCurrency(tier.threshold)} Umsatz</div>
                </div>
                <div class="tier-overview-rewards">
                    <div class="tier-overview-bonus">${formatCurrency(tier.bonus)} Bonus</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderEntries() {
    const entries = getEntriesForMonth(currentMonth);
    const list = document.getElementById('entriesList');
    const empty = document.getElementById('entriesEmpty');
    const totalRow = document.getElementById('entriesTotalRow');
    const count = document.getElementById('entryCount');

    if (entries.length === 0) {
        list.innerHTML = '';
        empty.hidden = false;
        totalRow.hidden = true;
        count.textContent = '';
        return;
    }

    empty.hidden = true;
    totalRow.hidden = false;
    count.textContent = `${entries.length} Einträge`;

    list.innerHTML = entries.map(e => `
        <div class="entry-item">
            <div class="entry-info">
                <div class="entry-date">${formatDate(e.date)}</div>
                <div class="entry-desc">${e.description || '—'}</div>
            </div>
            <div class="entry-amount">+${formatCurrency(e.amount)}</div>
            <div class="entry-actions">
                <button class="entry-action" onclick="editEntry('${e.id}')" title="Bearbeiten">✏️</button>
                <button class="entry-action" onclick="deleteEntry('${e.id}')" title="Löschen">🗑️</button>
            </div>
        </div>
    `).join('');

    const total = entries.reduce((s, e) => s + e.amount, 0);
    document.getElementById('entriesTotal').textContent = formatCurrency(total);
}

function renderTimesheet() {
    const entries = getTimeEntriesForMonth(currentMonth);
    const tbody = document.getElementById('timesheetBody');
    const empty = document.getElementById('timesheetEmpty');
    const table = document.querySelector('.timesheet-table-wrap');

    if (entries.length === 0) {
        tbody.innerHTML = '';
        empty.hidden = false;
        table.style.display = 'none';
        document.getElementById('timesheetTotal').textContent = '0:00';
        return;
    }

    empty.hidden = true;
    table.style.display = '';

    let totalMinutes = 0;
    tbody.innerHTML = entries.map(e => {
        const netMin = calcNetMinutes(e);
        totalMinutes += netMin;
        return `
            <tr>
                <td>${formatDate(e.date)}</td>
                <td>${getWeekday(e.date)}</td>
                <td>${e.startTime}</td>
                <td>${e.endTime}</td>
                <td>${e.breakMinutes} min</td>
                <td><strong>${minutesToHours(netMin)}</strong></td>
                <td>${e.note || '—'}</td>
                <td class="no-print">
                    <button class="entry-action" onclick="editTimeEntry('${e.id}')" title="Bearbeiten">✏️</button>
                    <button class="entry-action" onclick="deleteTimeEntry('${e.id}')" title="Löschen">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('timesheetTotal').textContent = minutesToHours(totalMinutes);
}

function calcNetMinutes(entry) {
    const [sh, sm] = entry.startTime.split(':').map(Number);
    const [eh, em] = entry.endTime.split(':').map(Number);
    const totalMin = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max(0, totalMin - (entry.breakMinutes || 0));
}

function minutesToHours(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
}


// ============================================================
// CRUD — UMSATZ
// ============================================================
const entryForm = document.getElementById('entryForm');
const entryDate = document.getElementById('entryDate');
const entryAmount = document.getElementById('entryAmount');
const entryDescription = document.getElementById('entryDescription');

entryDate.value = new Date().toISOString().split('T')[0];

entryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const oldTotal = getMonthlyTotal(currentMonth);
    const oldTier = getCurrentTier(oldTotal);

    const entry = await API.createEntry({
        date: entryDate.value,
        amount: parseFloat(entryAmount.value),
        description: entryDescription.value.trim()
    });

    revenueEntries.push(entry);
    currentMonth = entry.date.substring(0, 7);

    const newTotal = getMonthlyTotal(currentMonth);
    const newTier = getCurrentTier(newTotal);

    if (newTier && getTierIndex(newTier) > getTierIndex(oldTier)) {
        setTimeout(() => showTierUpgrade(newTier, newTotal), 400);
    }

    const btn = entryForm.querySelector('.btn-primary');
    btn.classList.add('show-success');
    setTimeout(() => btn.classList.remove('show-success'), 1500);

    entryAmount.value = '';
    entryDescription.value = '';
    entryDate.value = new Date().toISOString().split('T')[0];
    renderAll();
});

async function deleteEntry(id) {
    if (!confirm('Eintrag wirklich löschen?')) return;
    await API.deleteEntry(id);
    revenueEntries = revenueEntries.filter(e => e.id !== id);
    renderAll();
}

function editEntry(id) {
    const entry = revenueEntries.find(e => e.id === id);
    if (!entry) return;

    document.getElementById('editId').value = id;
    document.getElementById('editType').value = 'revenue';
    document.getElementById('editRevenueFields').hidden = false;
    document.getElementById('editTimeFields').hidden = true;
    document.getElementById('editModalTitle').textContent = 'Umsatz bearbeiten';
    document.getElementById('editDate').value = entry.date;
    document.getElementById('editAmount').value = entry.amount;
    document.getElementById('editDescription').value = entry.description;
    document.getElementById('editModal').hidden = false;
}


// ============================================================
// CRUD — ZEITERFASSUNG
// ============================================================
const timeForm = document.getElementById('timeForm');
const timeDate = document.getElementById('timeDate');

timeDate.value = new Date().toISOString().split('T')[0];

timeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const entry = await API.createTimeEntry({
        date: document.getElementById('timeDate').value,
        startTime: document.getElementById('timeStart').value,
        endTime: document.getElementById('timeEnd').value,
        breakMinutes: parseInt(document.getElementById('timeBreak').value) || 0,
        note: document.getElementById('timeNote').value.trim()
    });

    timeEntries.push(entry);
    currentMonth = entry.date.substring(0, 7);

    const btn = timeForm.querySelector('.btn-primary');
    btn.classList.add('show-success');
    setTimeout(() => btn.classList.remove('show-success'), 1500);

    document.getElementById('timeStart').value = '';
    document.getElementById('timeEnd').value = '';
    document.getElementById('timeBreak').value = '30';
    document.getElementById('timeNote').value = '';
    timeDate.value = new Date().toISOString().split('T')[0];
    renderAll();
});

async function deleteTimeEntry(id) {
    if (!confirm('Zeiteintrag wirklich löschen?')) return;
    await API.deleteTimeEntry(id);
    timeEntries = timeEntries.filter(e => e.id !== id);
    renderAll();
}

function editTimeEntry(id) {
    const entry = timeEntries.find(e => e.id === id);
    if (!entry) return;

    document.getElementById('editId').value = id;
    document.getElementById('editType').value = 'time';
    document.getElementById('editRevenueFields').hidden = true;
    document.getElementById('editTimeFields').hidden = false;
    document.getElementById('editModalTitle').textContent = 'Zeiteintrag bearbeiten';
    document.getElementById('editTimeDate').value = entry.date;
    document.getElementById('editTimeStart').value = entry.startTime;
    document.getElementById('editTimeEnd').value = entry.endTime;
    document.getElementById('editTimeBreak').value = entry.breakMinutes;
    document.getElementById('editTimeNote').value = entry.note;
    document.getElementById('editModal').hidden = false;
}


// ============================================================
// EDIT MODAL
// ============================================================
document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const type = document.getElementById('editType').value;

    if (type === 'revenue') {
        const data = {
            date: document.getElementById('editDate').value,
            amount: parseFloat(document.getElementById('editAmount').value),
            description: document.getElementById('editDescription').value.trim()
        };
        await API.updateEntry(id, data);
        const entry = revenueEntries.find(e => e.id === id);
        if (entry) Object.assign(entry, data);
    } else {
        const data = {
            date: document.getElementById('editTimeDate').value,
            startTime: document.getElementById('editTimeStart').value,
            endTime: document.getElementById('editTimeEnd').value,
            breakMinutes: parseInt(document.getElementById('editTimeBreak').value) || 0,
            note: document.getElementById('editTimeNote').value.trim()
        };
        await API.updateTimeEntry(id, data);
        const entry = timeEntries.find(e => e.id === id);
        if (entry) Object.assign(entry, data);
    }

    closeEditModal();
    renderAll();
});

function closeEditModal() {
    document.getElementById('editModal').hidden = true;
}


// ============================================================
// TIER UPGRADE — KONFETTI + MODAL
// ============================================================
function showTierUpgrade(tier, total) {
    const rewards = calculateRewards(total);
    document.getElementById('modalIcon').textContent = tier.icon;
    document.getElementById('modalTitle').textContent = `${tier.name} erreicht!`;

    let text = `Herzlichen Glückwunsch! Du hast ${formatCurrency(total)} Umsatz gemacht!`;
    if (rewards.bonus > 0) text += `\nBonus: ${formatCurrency(rewards.bonus)}`;

    document.getElementById('modalText').textContent = text;
    document.getElementById('tierModal').hidden = false;
    launchConfetti(tier.color);
}

function closeTierModal() {
    document.getElementById('tierModal').hidden = true;
}


// ============================================================
// KONFETTI ENGINE
// ============================================================
function launchConfetti(accentColor) {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = [accentColor, '#6366f1', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];
    const particles = [];

    for (let i = 0; i < 180; i++) {
        particles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 200,
            y: canvas.height / 2 - 100,
            vx: (Math.random() - 0.5) * 15,
            vy: Math.random() * -18 - 5,
            size: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 12,
            shape: Math.random() > 0.5 ? 'rect' : 'circle',
            opacity: 1
        });
    }

    let frame = 0;
    const maxFrames = 180;

    function animate() {
        frame++;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            p.x += p.vx;
            p.vy += 0.4;
            p.y += p.vy;
            p.vx *= 0.99;
            p.rotation += p.rotSpeed;

            if (frame > maxFrames - 40) p.opacity = Math.max(0, p.opacity - 0.025);

            ctx.save();
            ctx.globalAlpha = p.opacity;
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;

            if (p.shape === 'rect') {
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });

        if (frame < maxFrames) requestAnimationFrame(animate);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    animate();
}


// ============================================================
// MINI CHART (Dashboard)
// ============================================================
function renderMiniChart() {
    const entries = getEntriesForMonth(currentMonth);
    const canvas = document.getElementById('miniChart');
    const empty = document.getElementById('miniChartEmpty');

    if (entries.length === 0) {
        empty.hidden = false;
        canvas.style.display = 'none';
        return;
    }

    empty.hidden = true;
    canvas.style.display = '';

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 150 * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = 150;
    const padding = { top: 10, right: 10, bottom: 25, left: 50 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const last10 = entries.slice(-10);
    const maxVal = Math.max(...last10.map(e => e.amount)) * 1.15;
    const barW = Math.min(chartW / last10.length - 4, 40);

    ctx.clearRect(0, 0, w, h);

    last10.forEach((entry, i) => {
        const barH = (entry.amount / maxVal) * chartH;
        const x = padding.left + (i * (chartW / last10.length)) + (chartW / last10.length - barW) / 2;
        const y = padding.top + chartH - barH;

        const gradient = ctx.createLinearGradient(x, y, x, y + barH);
        gradient.addColorStop(0, '#6366f1');
        gradient.addColorStop(1, '#a5b4fc');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 4);
        ctx.fill();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(entry.date.split('-')[2] + '.', x + barW / 2, h - 5);
    });

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 3; i++) {
        const val = (maxVal / 3) * i;
        const y = padding.top + chartH - (chartH / 3) * i;
        ctx.fillText(Math.round(val) + '€', padding.left - 5, y + 3);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
    }
}


// ============================================================
// STATISTICS
// ============================================================
function renderStatistics() {
    renderStatsChart();
    renderStatsTable();
    renderYearStats();
}

function getMonthsWithData() {
    const months = new Set();
    revenueEntries.forEach(e => months.add(e.date.substring(0, 7)));
    timeEntries.forEach(e => months.add(e.date.substring(0, 7)));
    if (months.size === 0) months.add(currentMonth);
    return [...months].sort();
}

function getLast12Months() {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
}

function renderStatsChart() {
    const canvas = document.getElementById('statsChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 250 * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = 250;
    const padding = { top: 15, right: 15, bottom: 35, left: 55 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const months = getLast12Months();
    const data = months.map(m => ({ month: m, total: getMonthlyTotal(m) }));
    const maxVal = Math.max(...data.map(d => d.total), CONFIG.tiers[0].threshold) * 1.15 || 1000;
    const barW = Math.min(chartW / months.length - 6, 35);

    ctx.clearRect(0, 0, w, h);

    CONFIG.tiers.forEach(tier => {
        const y = padding.top + chartH - (tier.threshold / maxVal) * chartH;
        if (y > padding.top) {
            ctx.strokeStyle = tier.color + '40';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    });

    data.forEach((d, i) => {
        const barH = Math.max(0, (d.total / maxVal) * chartH);
        const x = padding.left + (i * (chartW / months.length)) + (chartW / months.length - barW) / 2;
        const y = padding.top + chartH - barH;

        const tier = getCurrentTier(d.total);
        const color = tier ? tier.color : '#cbd5e1';

        const gradient = ctx.createLinearGradient(x, y, x, y + barH);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + '60');
        ctx.fillStyle = gradient;

        if (barH > 0) {
            ctx.beginPath();
            ctx.roundRect(x, y, barW, barH, 3);
            ctx.fill();
        }

        if (d.month === currentMonth) {
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x - 1, y - 1, barW + 2, barH + 2, 4);
            ctx.stroke();
        }

        ctx.fillStyle = d.month === currentMonth ? '#6366f1' : '#94a3b8';
        ctx.font = `${d.month === currentMonth ? 'bold ' : ''}9px Inter, sans-serif`;
        ctx.textAlign = 'center';
        const monthShort = new Date(parseInt(d.month.split('-')[0]), parseInt(d.month.split('-')[1]) - 1, 1)
            .toLocaleDateString(CONFIG.locale, { month: 'short' });
        ctx.fillText(monthShort, x + barW / 2, h - 8);
    });

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const val = (maxVal / 4) * i;
        const y = padding.top + chartH - (chartH / 4) * i;
        ctx.fillText((val / 1000).toFixed(1) + 'k', padding.left - 5, y + 3);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
    }
}

function renderStatsTable() {
    const months = getMonthsWithData();
    const tbody = document.getElementById('statsTableBody');

    tbody.innerHTML = months.map(m => {
        const total = getMonthlyTotal(m);
        const tier = getCurrentTier(total);
        const rewards = calculateRewards(total);
        return `
            <tr${m === currentMonth ? ' style="background:#eef2ff"' : ''}>
                <td>${getMonthLabel(m)}</td>
                <td><strong>${formatCurrency(total)}</strong></td>
                <td>${tier ? `${tier.icon} ${tier.name}` : '—'}</td>
                <td>${rewards.bonus > 0 ? formatCurrency(rewards.bonus) : '—'}</td>
            </tr>
        `;
    }).join('');
}

function renderYearStats() {
    const year = currentMonth.split('-')[0];
    const yearMonths = [];
    for (let m = 1; m <= 12; m++) yearMonths.push(`${year}-${String(m).padStart(2, '0')}`);

    const yearTotals = yearMonths.map(m => getMonthlyTotal(m));
    const yearTotal = yearTotals.reduce((s, t) => s + t, 0);
    const monthsWithRevenue = yearTotals.filter(t => t > 0).length;
    const avgMonth = monthsWithRevenue > 0 ? yearTotal / monthsWithRevenue : 0;

    const bestIdx = yearTotals.indexOf(Math.max(...yearTotals));
    const bestMonth = yearTotals[bestIdx] > 0
        ? getMonthLabel(yearMonths[bestIdx]) + ` (${formatCurrency(yearTotals[bestIdx])})`
        : '—';

    let yearMinutes = 0;
    yearMonths.forEach(m => {
        getTimeEntriesForMonth(m).forEach(e => { yearMinutes += calcNetMinutes(e); });
    });

    document.getElementById('statYearTotal').textContent = formatCurrency(yearTotal);
    document.getElementById('statMonthAvg').textContent = formatCurrency(avgMonth);
    document.getElementById('statBestMonth').textContent = bestMonth;
    document.getElementById('statYearHours').textContent = minutesToHours(yearMinutes);
}


// ============================================================
// DATEN EXPORT / IMPORT / RESET
// ============================================================
document.getElementById('exportData').addEventListener('click', async () => {
    const data = await API.exportData();
    data.config = CONFIG;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `umsatztracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('importData').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (!data.revenueEntries && !data.timeEntries) { alert('Ungültige Datei!'); return; }
            if (!confirm('Vorhandene Daten werden überschrieben. Fortfahren?')) return;

            await API.importData(data);
            revenueEntries = data.revenueEntries || [];
            timeEntries = data.timeEntries || [];
            renderAll();
            alert('Daten erfolgreich importiert!');
        } catch { alert('Fehler beim Lesen der Datei!'); }
    };
    reader.readAsText(file);
    e.target.value = '';
});

document.getElementById('resetData').addEventListener('click', async () => {
    if (!confirm('Alle Daten wirklich löschen?')) return;
    if (!confirm('Bist du sicher? Das kann nicht rückgängig gemacht werden!')) return;

    await API.resetData();
    revenueEntries = [];
    timeEntries = [];
    renderAll();
    alert('Alle Daten wurden gelöscht.');
});


// ============================================================
// PRINT + RESIZE
// ============================================================
document.getElementById('printTimesheet').addEventListener('click', () => window.print());

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        renderMiniChart();
        if (document.getElementById('tab-statistics').classList.contains('active')) renderStatsChart();
    }, 200);
});


// ============================================================
// INIT — Daten vom Server laden
// ============================================================
async function init() {
    try {
        [revenueEntries, timeEntries] = await Promise.all([
            API.getEntries(),
            API.getTimeEntries()
        ]);
    } catch (err) {
        console.error('Fehler beim Laden der Daten:', err);
        revenueEntries = [];
        timeEntries = [];
    }
    renderAll();
}

init();
