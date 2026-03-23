/**
 * Param & Yolum - Robust Financial Core 🏛️
 * Defensive Scripting Architecture + Live Market Engine (Auto-Refresh) 📡
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial State Loading & Recovery
    let state;
    try {
        state = JSON.parse(localStorage.getItem('birikim_pro_state')) || {};
    } catch (e) {
        state = {};
    }

    // Default Fallbacks with modern 2026 prices
    const defaultState = {
        entries: [],
        projectionSettings: { initial: 100000, monthly: 100000, rate: 0.10, duration: 120 },
        assets: { stocks: 0, usd: 0, eur: 0, rateUsd: 32.5, rateEur: 35.2, bfren_count: 0, bfren_avg: 0, gold_count: 0, ypp_count: 0 },
        market: { usd: 32.61, eur: 35.34, gold: 2441, bfren: 141.80, ypp: 0.123445 },
        users: { name1: "Ben", name2: "Eşim" },
        theme: 'dark'
    };

    // Deep merge or ensure fields
    state = { ...defaultState, ...state };
    state.assets = { ...defaultState.assets, ...state.assets };
    state.market = { ...defaultState.market, ...state.market };
    state.users = { ...defaultState.users, ...state.users };
    state.projectionSettings = { ...defaultState.projectionSettings, ...state.projectionSettings };

    let currentDate = new Date(2026, 2, 23);
    let projectionChart = null;
    let projectionData = [];

    const saveState = () => localStorage.setItem('birikim_pro_state', JSON.stringify(state));

    const setupEl = (id, event, callback) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, callback);
        return el;
    };

    const formatCurrency = (v) => {
        try {
            return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);
        } catch (e) { return (v || 0) + " ₺"; }
    };

    // --- CLOCK & DATE ---
    const updateClock = () => {
        try {
            const now = new Date();
            const d = now.getDate(), m = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"][now.getMonth()], y = now.getFullYear();
            const hr = String(now.getHours()).padStart(2,'0'), min = String(now.getMinutes()).padStart(2,'0'), sec = String(now.getSeconds()).padStart(2,'0');
            const el = document.getElementById('live-clock');
            if (el) el.textContent = `${d} ${m} ${y} | ${hr}:${min}:${sec}`;
        } catch(e){}
    };
    setInterval(updateClock, 1000); updateClock();

    // --- THEME ---
    const setTheme = (t) => {
        document.body.className = `theme-${t}`;
        document.querySelectorAll('.theme-dot').forEach(dot => dot.classList.toggle('active', dot.dataset.theme === t));
        state.theme = t; saveState();
    };
    document.querySelectorAll('.theme-dot').forEach(dot => dot.addEventListener('click', () => setTheme(dot.dataset.theme)));
    setTheme(state.theme || 'dark');

    // --- TABS ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tEl = document.getElementById(target);
            if (tEl) tEl.classList.add('active');
            
            if (target === 'projection') initProjection();
            if (target === 'borsa') initTradingView();
            if (target === 'market') updateMarketUI();
            updateDashboard();
        });
    });

    // --- DYNAMIC LABELS ---
    const syncUserNames = () => {
        const n1El = document.getElementById('user-name-1'), n2El = document.getElementById('user-name-2');
        if (n1El) state.users.name1 = n1El.value || "Ben";
        if (n2El) state.users.name2 = n2El.value || "Eşim";
        document.querySelectorAll('.name1-opt').forEach(opt => { opt.textContent = opt.textContent.split(' (')[0] + ` (${state.users.name1})`; opt.value = opt.textContent; });
        document.querySelectorAll('.name2-opt').forEach(opt => { opt.textContent = opt.textContent.split(' (')[0] + ` (${state.users.name2})`; opt.value = opt.textContent; });
        const b1 = document.getElementById('q-btn-1'), b2 = document.getElementById('q-btn-2');
        if (b1) { b1.textContent = `Maaş (${state.users.name1})`; b1.dataset.cat = b1.textContent; }
        if (b2) { b2.textContent = `Maaş (${state.users.name2})`; b2.dataset.cat = b2.textContent; }
        saveState();
    };
    setupEl('user-name-1', 'input', syncUserNames);
    setupEl('user-name-2', 'input', syncUserNames);

    // --- MARKET UPDATE (LIVE POLLING 📡) ---
    const fetchLiveMarket = async () => {
        const refreshBtn = document.getElementById('refresh-market');
        if (refreshBtn) refreshBtn.innerHTML = "Güncelleniyor... 🔄";
        try {
            // 1. Dolar & Euro (Frankfurter is reliably fast)
            const fxResp = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY,EUR');
            const fxData = await fxResp.json();
            state.market.usd = fxData.rates.TRY;
            state.market.eur = fxData.rates.TRY / fxData.rates.EUR;
            
            // 2. Stocks & Gold (Yahoo Finance via Proxy)
            const symbols = ['BFREN.IS', 'GC=F'];
            const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/chart/`;
            for (let symbol of symbols) {
                try {
                    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl + symbol + "?interval=1m&range=1d")}`;
                    const resp = await fetch(proxyUrl);
                    const data = await resp.json();
                    const content = JSON.parse(data.contents);
                    const price = content.chart.result[0].meta.regularMarketPrice;
                    
                    if (symbol === 'BFREN.IS' && price > 0) state.market.bfren = price;
                    if (symbol === 'GC=F' && price > 0) state.market.gold = (price / 31.1) * state.market.usd;
                } catch(err){}
            }
            saveState(); updateMarketUI(); updateDashboard();
        } catch (e) {}
        if (refreshBtn) refreshBtn.innerHTML = "Kurları Güncelle 📡";
    };

    const updateMarketUI = () => {
        const els = { usd: 'live-usd', eur: 'live-eur', gold: 'live-gold', bfren: 'live-bfren', ypp: 'live-ypp' };
        for (let k in els) {
            const el = document.getElementById(els[k]);
            if (el) {
                let val = state.market[k] || 0;
                let oldVal = el.textContent;
                let newVal = k === 'ypp' ? val.toFixed(6) : val.toFixed(k==='gold'||k==='bfren'?2:2) + (k==='ypp'?'':' ₺');
                
                if (oldVal !== newVal) {
                    el.textContent = newVal;
                    el.classList.add('amt-gain'); // Small flash
                    setTimeout(() => el.classList.remove('amt-gain'), 1000);
                }
            }
        }
    };

    window.updateManualItem = (key, label) => {
        let val = prompt(`${label} için yeni fiyat (Bölünmüş fiyat örn: 141,80):`, state.market[key] || 0);
        if (val !== null) {
            let cleaned = val.toString().replace(',', '.');
            let num = parseFloat(cleaned);
            if (!isNaN(num)) {
                state.market[key] = num;
                saveState(); updateMarketUI(); updateDashboard();
                alert(`✅ ${label} Başarıyla Güncellendi: ${num}`);
            } else { alert("❌ Geçersiz sayı!"); }
        }
    };
    setupEl('refresh-market', 'click', fetchLiveMarket);

    // Auto Refresh every 30 seconds
    setInterval(fetchLiveMarket, 30000);

    // --- CALCULATORS ---
    setupEl('calc-loan', 'click', () => {
        const P = parseFloat(document.getElementById('loan-amount').value), r = (parseFloat(document.getElementById('loan-rate').value)||0)/100, n = parseFloat(document.getElementById('loan-term').value);
        if (P && r && n) document.getElementById('loan-result').textContent = `Taksit: ${formatCurrency((P*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1))}`;
    });
    setupEl('calc-deposit', 'click', () => {
        const P = parseFloat(document.getElementById('deposit-amount').value), R = parseFloat(document.getElementById('deposit-rate').value), D = parseFloat(document.getElementById('deposit-days').value);
        if (P && R && D) document.getElementById('deposit-result').textContent = `Net Getiri: ${formatCurrency((P*R*D)/36500*0.95)}`;
    });

    // --- LEDGER ---
    const updateEntriesUI = () => {
        const entryList = document.getElementById('entry-list'), ledgerMonthEl = document.getElementById('current-ledger-month');
        if (!entryList || !ledgerMonthEl) return;
        entryList.innerHTML = '';
        ledgerMonthEl.textContent = `${["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"][currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        const key = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
        (state.entries || []).filter(e => e.monthKey === key).forEach(e => {
            const li = document.createElement('li');
            const symbols = { 'TRY': '₺', 'USD': '$', 'EUR': '€', 'GOLD': ' Gr' };
            const symbol = symbols[e.currency || 'TRY'] || '₺';
            const displayAmt = e.currency === 'GOLD' ? `${e.amount}${symbol}` : (e.currency === 'TRY' ? formatCurrency(e.amount) : `${e.amount}${symbol}`);
            li.innerHTML = `<span>${e.desc}</span><span class="amt-${e.type}">${e.type === 'income' ? '+' : '-'}${displayAmt}</span>`;
            entryList.appendChild(li);
        });
        saveState(); updateDashboard();
    };

    setupEl('add-entry-btn', 'click', () => {
        const catSelect = document.getElementById('entry-category-select'), amtInput = document.getElementById('entry-amount'), curSelect = document.getElementById('entry-currency');
        if (!amtInput.value || !catSelect.value) return;
        const isExp = !['Maaş', 'Ek Ders', 'Gelir', 'Sınav Görevi'].some(k => catSelect.value.includes(k));
        state.entries.push({ 
            desc: catSelect.value, 
            amount: parseFloat(amtInput.value), 
            currency: curSelect.value || 'TRY',
            type: isExp ? 'expense' : 'income', 
            monthKey: `${currentDate.getFullYear()}-${currentDate.getMonth()}`, 
            id: Date.now() 
        });
        amtInput.value = ''; updateEntriesUI();
    });

    document.querySelectorAll('.quick-btn').forEach(b => b.addEventListener('click', () => {
        const val = prompt(`${b.dataset.cat} miktarı (₺):`);
        if (val) {
            const isExp = b.classList.contains('gid-btn');
            state.entries.push({ desc: b.dataset.cat, amount: parseFloat(val), currency: 'TRY', type: isExp ? 'expense' : 'income', monthKey: `${currentDate.getFullYear()}-${currentDate.getMonth()}`, id: Date.now() });
            updateEntriesUI();
        }
    }));

    setupEl('clear-entries', 'click', () => { state.entries = state.entries.filter(e => e.monthKey !== `${currentDate.getFullYear()}-${currentDate.getMonth()}`); updateEntriesUI(); });
    setupEl('prev-month', 'click', () => { currentDate.setMonth(currentDate.getMonth() - 1); updateEntriesUI(); });
    setupEl('next-month', 'click', () => { currentDate.setMonth(currentDate.getMonth() + 1); updateEntriesUI(); });
    setupEl('sync-to-proj', 'click', () => {
        const key = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
        let netTry = 0; 
        const mUsd = state.market.usd || 1, mEur = state.market.eur || 1, mGold = state.market.gold || 1;
        
        state.entries.filter(e => e.monthKey === key).forEach(e => {
            const cur = e.currency || 'TRY';
            let amt = e.amount;
            if (cur === 'USD') amt *= mUsd;
            else if (cur === 'EUR') amt *= mEur;
            else if (cur === 'GOLD') amt *= mGold;

            if (e.type === 'income') netTry += amt; 
            else netTry -= amt; 
        });

        if (netTry > 0) {
            const pMon = document.getElementById('proj-monthly');
            if (pMon) { pMon.value = netTry.toFixed(0); state.projectionSettings.monthly = netTry; alert('Kalan bakiyeniz (TRY karşılığı) geleceğe aktarıldı! 🚀'); initProjection(); }
        } else {
            alert('Aktarılacak pozitif bir bakiye bulunamadı.');
        }
    });

    // --- PROJECTION ---
    const initProjection = () => {
        const pIni = document.getElementById('proj-initial'), pMon = document.getElementById('proj-monthly'), pRate = document.getElementById('proj-rate'), pDur = document.getElementById('proj-duration');
        if (!pIni || !pMon || !pRate || !pDur) return;
        let bal = parseFloat(pIni.value)||0, mon = parseFloat(pMon.value)||0, rate = (parseFloat(pRate.value)||0)/100, dur = parseInt(pDur.value);
        projectionData = []; let bal5yr = 0, bal10yr = 0;
        const calcLimit = Math.max(dur, 120);
        for (let m = 1; m <= calcLimit; m++) {
            let prof = 0;
            for (let d = 1; d <= 30; d++) { if (d === 15) bal += mon; const p = bal * rate; bal += p; prof += p; }
            if (m <= dur) projectionData.push({ month: m, added: mon, profit: prof, balance: bal });
            if (m === 60) bal5yr = bal; if (m === 120) bal10yr = bal;
        }
        if (document.getElementById('target-5yr')) document.getElementById('target-5yr').textContent = formatCurrency(bal5yr);
        if (document.getElementById('target-10yr')) document.getElementById('target-10yr').textContent = formatCurrency(bal10yr);
        renderProjection('monthly');
        const cEl = document.getElementById('projectionChart');
        if (cEl) {
            if (projectionChart) projectionChart.destroy();
            projectionChart = new Chart(cEl, {
                type: 'line', data: { labels: projectionData.map(d => `${d.month}.Ay`), datasets: [{ data: projectionData.map(d => d.balance), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4, pointRadius: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: '#94a3b8', callback: v => `${(v/1000).toFixed(0)}k` } }, x: { ticks: { color: '#94a3b8', maxTicksLimit: 12 } } } }
            });
        }
        state.projectionSettings = { initial: parseFloat(pIni.value), monthly: mon, rate: pRate.value, duration: dur }; saveState();
    };

    const renderProjection = (v) => {
        const tBody = document.querySelector('#projection-table tbody'), tHeadRow = document.getElementById('table-head-row');
        if (!tBody || !tHeadRow) return;
        let html = '';
        if (v === 'monthly') {
            tHeadRow.innerHTML = `<th>Ay</th><th>Ekleme</th><th>Kazanç</th><th>Bakiye</th>`;
            projectionData.forEach(d => html += `<tr><td><b>${d.month}. Ay</b></td><td>${formatCurrency(d.added)}</td><td style="color:var(--accent-emerald)">+${formatCurrency(d.profit)}</td><td>${formatCurrency(d.balance)}</td></tr>`);
        } else {
            tHeadRow.innerHTML = `<th>Yıl</th><th>Yıllık Tahsilat</th><th>Yıllık Faiz</th><th>Yıl Sonu Bakiye</th>`;
            for (let y = 1; y <= Math.ceil(projectionData.length / 12); y++) {
                const sl = projectionData.slice((y-1)*12, y*12);
                if (sl.length) html += `<tr><td><b>${y}. Yıl</b></td><td>${formatCurrency(sl.reduce((a,b)=>a+b.added,0))}</td><td style="color:var(--accent-emerald)">+${formatCurrency(sl.reduce((a,b)=>a+b.profit,0))}</td><td>${formatCurrency(sl[sl.length-1].balance)}</td></tr>`;
            }
        }
        tBody.innerHTML = html;
        document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    };
    document.querySelectorAll('.sub-tab-btn').forEach(btn => btn.addEventListener('click', () => renderProjection(btn.dataset.view)));
    setupEl('recalc-btn', 'click', initProjection);

    // --- DASHBOARD UPDATER ---
    const updateDashboard = () => {
        const key = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
        
        let incByCurrency = { TRY: 0, USD: 0, EUR: 0, GOLD: 0 };
        let expByCurrency = { TRY: 0, USD: 0, EUR: 0, GOLD: 0 };

        (state.entries || []).filter(e => e.monthKey === key).forEach(e => {
            const cur = e.currency || 'TRY';
            if (e.type === 'income') incByCurrency[cur] += e.amount;
            else expByCurrency[cur] += e.amount;
        });

        // Convert totals for header
        const mUsd = state.market.usd || 1, mEur = state.market.eur || 1, mGold = state.market.gold || 1;
        const totalIncTry = incByCurrency.TRY + (incByCurrency.USD * mUsd) + (incByCurrency.EUR * mEur) + (incByCurrency.GOLD * mGold);
        const totalExpTry = expByCurrency.TRY + (expByCurrency.USD * mUsd) + (expByCurrency.EUR * mEur) + (expByCurrency.GOLD * mGold);
        
        const bPrice = state.market.bfren || 0, bCount = state.assets.bfren_count || 0, bAvg = state.assets.bfren_avg || 0;
        const bVal = bCount * bPrice, bCost = bCount * bAvg, bPL = bVal - bCost, bPLP = bCost > 0 ? (bPL/bCost)*100 : 0;
        
        if (document.getElementById('bfren-total-val')) document.getElementById('bfren-total-val').textContent = formatCurrency(bVal);
        const bPLEl = document.getElementById('bfren-profit-loss');
        if (bPLEl) { bPLEl.textContent = `${formatCurrency(bPL)} (${bPLP.toFixed(2)}%)`; bPLEl.className = bPL >= 0 ? 'amt-gain' : 'amt-loss'; }

        // Net income/balance from ledger for each currency
        const netTry = incByCurrency.TRY - expByCurrency.TRY;
        const netUsd = incByCurrency.USD - expByCurrency.USD;
        const netEur = incByCurrency.EUR - expByCurrency.EUR;
        const netGold = incByCurrency.GOLD - expByCurrency.GOLD;

        const breakdownItems = [
            { name: "🚜 BFREN Hisse", miktar: bCount, fiyat: bPrice, unit: "Lot" },
            { name: "🌕 Gram Altın", miktar: (state.assets.gold_count || 0) + netGold, fiyat: mGold, unit: "Gr" },
            { name: "🏛️ YPP Para Fonu", miktar: state.assets.ypp_count || 0, fiyat: state.market.ypp || 0, unit: "Adet" },
            { name: "💵 Dolar ($)", miktar: (state.assets.usd || 0) + netUsd, fiyat: mUsd, unit: "$" },
            { name: "💶 Euro (€)", miktar: (state.assets.eur || 0) + netEur, fiyat: mEur, unit: "€" },
            { name: "💰 Nakit (₺) / Bakiye", miktar: netTry, fiyat: 1, unit: "₺" }
        ];

        let totalWealth = 0; 
        const bodyEl = document.getElementById('breakdown-body');
        if (bodyEl) {
            let tableHtml = '';
            breakdownItems.forEach(item => {
                const total = item.miktar * item.fiyat;
                totalWealth += total;
                if (Math.abs(item.miktar) > 0.0001) { // Show if non-zero
                    const priceDisp = item.fiyat < 1 ? item.fiyat.toFixed(6) : item.fiyat.toFixed(2);
                    const miktarDisp = item.unit === '₺' ? formatCurrency(item.miktar) : `${item.miktar.toFixed(2)} ${item.unit}`;
                    tableHtml += `<tr><td>${item.name}</td><td>${miktarDisp}</td><td>${priceDisp} ₺</td><td>${formatCurrency(total)}</td></tr>`;
                }
            });
            tableHtml += `<tr style="background:rgba(16,185,129,0.1); font-weight:700;"><td>GENEL TOPLAM</td><td>-</td><td>-</td><td style="color:var(--accent-emerald)">${formatCurrency(totalWealth)}</td></tr>`;
            bodyEl.innerHTML = tableHtml;
        }

        if (document.getElementById('net-wealth')) document.getElementById('net-wealth').textContent = formatCurrency(totalWealth);
        if (document.getElementById('dash-total-income')) document.getElementById('dash-total-income').textContent = formatCurrency(totalIncTry);
        if (document.getElementById('dash-total-expense')) document.getElementById('dash-total-expense').textContent = formatCurrency(totalExpTry);
        if (document.getElementById('dash-capital')) document.getElementById('dash-capital').textContent = formatCurrency(state.projectionSettings.initial);
    };

    // --- INITIALIZE ---
    const assetInputs = ['bfren-count', 'bfren-avg', 'gold-count', 'ypp-count', 'asset-usd', 'asset-eur'];
    assetInputs.forEach(id => setupEl(id, 'input', (e) => {
        state.assets[id.replace('-', '_')] = parseFloat(e.target.value) || 0;
        updateDashboard();
    }));

    if (state.users && document.getElementById('user-name-1')) { document.getElementById('user-name-1').value = state.users.name1; document.getElementById('user-name-2').value = state.users.name2; syncUserNames(); }
    assetInputs.forEach(id => { const el = document.getElementById(id); if (el) el.value = state.assets[id.replace('-', '_')] || ''; });
    const pI = document.getElementById('proj-initial');
    if (pI) { pI.value = state.projectionSettings.initial; document.getElementById('proj-monthly').value = state.projectionSettings.monthly; document.getElementById('proj-rate').value = state.projectionSettings.rate; document.getElementById('proj-duration').value = state.projectionSettings.duration || 120; }
    
    updateEntriesUI(); updateMarketUI(); initProjection(); fetchLiveMarket();

    let tvInitialized = false;
    const initTradingView = () => {
        if (tvInitialized || !document.getElementById('tv-widget')) return;
        const script = document.createElement('script');
        script.src = "https://s3.tradingview.com/tv.js"; script.async = true;
        script.onload = () => {
            try { new TradingView.MediumWidget({ "symbols": [["BIST 100", "BIST:XU100|1D"], ["BFREN", "BIST:BFREN|1D"]], "width": "100%", "height": 550, "locale": "tr", "colorTheme": state.theme === 'light' ? 'light' : 'dark', "isTransparent": true, "autosize": true, "container_id": "tv-widget" }); tvInitialized = true; } catch(e){}
        };
        document.head.appendChild(script);
    };
});
