document.addEventListener('DOMContentLoaded', async () => {
    await Storage.init();
    applyTheme();
    
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('download-csv-btn').addEventListener('click', downloadCSV);
    document.getElementById('reset-election-btn').addEventListener('click', resetElection);
    document.getElementById('save-config-btn').addEventListener('click', saveConfig);
    document.getElementById('add-position-btn').addEventListener('click', addPosition);
    document.getElementById('save-candidates-btn').addEventListener('click', savePositions);
    document.getElementById('download-results-csv-btn').addEventListener('click', downloadResultsCSV);
    
    // Tab switching logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });
});

function applyTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('theme-toggle').textContent = savedTheme === 'light' ? '🌙' : '☀️';
    
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        document.getElementById('theme-toggle').textContent = newTheme === 'light' ? '🌙' : '☀️';
    });
}

async function handleLogin() {
    const pass = document.getElementById('admin-password').value;
    
    // Easter Egg Check
    if (pass.toLowerCase() === 'admin' && Storage.config.adminPassword !== 'admin') {
        document.getElementById('login-error').textContent = 'Nice try! The admin was smart enough to change the default password. 😂';
        return;
    }
    
    const btn = document.getElementById('login-btn');
    btn.textContent = 'Verifying...';
    
    try {
        await Storage.adminLogin(pass);
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        loadDashboard();
    } catch (e) {
        document.getElementById('login-error').textContent = e.message;
    } finally {
        btn.textContent = 'Login';
    }
}

async function loadDashboard() {
    const cfg = Storage.config;
    const editor = document.getElementById('config-editor');
    editor.innerHTML = `
        <div class="input-group">
            <label>Apartment Name</label>
            <input type="text" id="cfg-name" value="${cfg.apartmentName}">
        </div>
        <div class="input-group">
            <label>Election Banner</label>
            <input type="text" id="cfg-banner" value="${cfg.electionBanner}">
        </div>
        <div class="input-group">
            <label>Voting Closes (ISO Date)</label>
            <input type="text" id="cfg-date" value="${cfg.votingCloses}">
        </div>
        <div class="input-group">
            <label>Google Apps Script Web App URL (Leave empty for LocalStorage)</label>
            <input type="text" id="cfg-google" value="${cfg.googleAppUrl || ''}" placeholder="https://script.google.com/macros/s/...">
        </div>
    `;

    renderPositionsEditor();
    await refreshVotes();
}

async function refreshVotes() {
    const votes = await Storage.getVotes();
    document.getElementById('total-votes-count').textContent = votes.length;
    
    renderLiveResults(votes);
    
    const tbody = document.getElementById('votes-tbody');
    tbody.innerHTML = '';
    votes.forEach(v => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(v.timestamp).toLocaleString()}</td>
            <td>${v.name}</td>
            <td>${v.flatNumber}</td>
            <td>${v.selections.map(s => s.name + ' (' + s.position + ')').join(', ')}</td>
            <td><button class="btn-danger text-small delete-btn" data-flat="${String(v.flatNumber).replace(/"/g, '&quot;')}" style="padding: 0.25rem 0.5rem">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (btn.textContent === 'Delete') {
                btn.textContent = 'Confirm?';
                btn.style.backgroundColor = '#dc2626'; // Darker red for confirm
                setTimeout(() => {
                    if (btn && btn.parentElement) {
                        btn.textContent = 'Delete';
                        btn.style.backgroundColor = '';
                    }
                }, 3000);
                return;
            }

            const flat = btn.dataset.flat;
            try {
                btn.textContent = 'Deleting...';
                await Storage.deleteVote(flat);
                await refreshVotes();
            } catch (e) {
                console.error(e);
                alert('Error deleting vote: ' + e.message);
            }
        });
    });
}

function renderLiveResults(votes) {
    const container = document.getElementById('live-results-container');
    container.innerHTML = '';
    
    // Aggregate votes
    const results = {};
    Storage.config.positions.forEach(pos => {
        results[pos.title] = {};
        pos.candidates.forEach(c => {
            results[pos.title][c.name] = 0;
        });
    });
    
    votes.forEach(v => {
        v.selections.forEach(sel => {
            if (results[sel.position]) {
                if (results[sel.position][sel.name] !== undefined) {
                    results[sel.position][sel.name]++;
                } else {
                    results[sel.position][sel.name] = 1;
                }
            }
        });
    });
    
    // Render
    Object.keys(results).forEach(posTitle => {
        const card = document.createElement('div');
        card.className = 'glass-card mb-1';
        card.style.padding = '1rem';
        
        let html = `<h3>${posTitle}</h3>`;
        
        // Convert to array and sort highest to lowest
        const candsArray = Object.keys(results[posTitle]).map(name => ({
            name: name,
            votes: results[posTitle][name]
        }));
        candsArray.sort((a, b) => b.votes - a.votes);
        
        if (candsArray.length === 0) {
            html += `<p class="text-small">No candidates</p>`;
        } else {
            candsArray.forEach((c, index) => {
                const count = c.votes;
                const medal = index === 0 && count > 0 ? '🏆 ' : '';
                html += `<div style="display:flex; justify-content:space-between; border-bottom: 1px solid var(--glass-border); padding: 0.5rem 0;">
                    <span>${medal}${c.name}</span>
                    <span style="font-weight:bold; color:var(--primary);">${count} votes</span>
                </div>`;
            });
        }
        card.innerHTML = html;
        container.appendChild(card);
    });
}

function renderPositionsEditor() {
    const container = document.getElementById('admin-positions-container');
    container.innerHTML = '';
    
    Storage.config.positions.forEach((pos, pIndex) => {
        const posDiv = document.createElement('div');
        posDiv.className = 'glass-card mb-1';
        posDiv.style.padding = '1rem';
        
        posDiv.innerHTML = `
            <div class="config-row">
                <div class="input-group">
                    <label>Position Title</label>
                    <input type="text" value="${pos.title}" onchange="updatePosTitle(${pIndex}, this.value)">
                </div>
                <button class="btn-danger" onclick="removePosition(${pIndex})">Delete Pos</button>
            </div>
            <h4>Candidates</h4>
            <div id="cands-${pIndex}"></div>
            <button class="btn-secondary text-small mt-1" onclick="addCandidate(${pIndex})">+ Add Candidate</button>
        `;
        
        container.appendChild(posDiv);
        
        const candsDiv = document.getElementById(`cands-${pIndex}`);
        pos.candidates.forEach((cand, cIndex) => {
            const cDiv = document.createElement('div');
            cDiv.className = 'config-row';
            cDiv.innerHTML = `
                <div class="input-group"><input type="text" placeholder="Name" value="${cand.name}" onchange="updateCand(${pIndex}, ${cIndex}, 'name', this.value)"></div>
                <div class="input-group"><input type="text" placeholder="Photo URL" value="${cand.photo}" onchange="updateCand(${pIndex}, ${cIndex}, 'photo', this.value)"></div>
                <div class="input-group"><input type="text" placeholder="Description" value="${cand.description}" onchange="updateCand(${pIndex}, ${cIndex}, 'description', this.value)"></div>
                <button class="btn-danger text-small" onclick="removeCandidate(${pIndex}, ${cIndex})">X</button>
            `;
            candsDiv.appendChild(cDiv);
        });
    });
}

window.updatePosTitle = function(pIndex, val) { Storage.config.positions[pIndex].title = val; };
window.updateCand = function(pIndex, cIndex, key, val) { Storage.config.positions[pIndex].candidates[cIndex][key] = val; };

window.removePosition = function(pIndex) {
    Storage.config.positions.splice(pIndex, 1);
    renderPositionsEditor();
};

window.addPosition = function() {
    Storage.config.positions.push({ id: 'pos_' + Date.now(), title: 'New Position', candidates: [] });
    renderPositionsEditor();
};

window.addCandidate = function(pIndex) {
    Storage.config.positions[pIndex].candidates.push({ id: 'c_' + Date.now(), name: '', photo: '', description: '' });
    renderPositionsEditor();
};

window.removeCandidate = function(pIndex, cIndex) {
    Storage.config.positions[pIndex].candidates.splice(cIndex, 1);
    renderPositionsEditor();
};

async function saveConfig() {
    const btn = document.getElementById('save-config-btn');
    btn.textContent = 'Saving...';
    
    const cfg = Storage.config;
    cfg.apartmentName = document.getElementById('cfg-name').value;
    cfg.electionBanner = document.getElementById('cfg-banner').value;
    cfg.votingCloses = document.getElementById('cfg-date').value;
    cfg.googleAppUrl = document.getElementById('cfg-google').value;
    
    try {
        await Storage.updateConfig(cfg);
        if (!Storage.isGoogleConfigured()) {
            downloadJSON(cfg, 'config.json');
            alert('Configuration saved to LocalStorage and downloaded! Please replace your project\'s config.json file with this downloaded file.');
        } else {
            alert('Configuration saved to Google Sheets!');
        }
    } catch (e) {
        alert('Error saving config: ' + e.message);
    }
    btn.textContent = 'Save Config';
}

async function savePositions() {
    const btn = document.getElementById('save-candidates-btn');
    btn.textContent = 'Saving...';
    try {
        await Storage.updateConfig(Storage.config);
        if (!Storage.isGoogleConfigured()) {
            downloadJSON(Storage.config, 'config.json');
            alert('Positions saved to LocalStorage and downloaded! Please replace your project\'s config.json file with this downloaded file.');
        } else {
            alert('Positions saved to Google Sheets!');
        }
    } catch (e) {
        alert('Error saving positions: ' + e.message);
    }
    btn.textContent = 'Save Positions';
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
}

async function downloadCSV() {
    try {
        const votes = await Storage.getVotes();
        if (votes.length === 0) return alert('No votes to download.');
        
        let csv = 'Timestamp,Name,FlatNumber,Selections\n';
        votes.forEach(v => {
            const selections = v.selections || [];
            const sels = selections.map(s => s.name + ' (' + s.position + ')').join(' | ');
            csv += `"${v.timestamp || ''}","${v.name || ''}","${v.flatNumber || ''}","${sels}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'votes_log.csv';
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    } catch (e) {
        alert('Error downloading CSV: ' + e.message);
    }
}

async function downloadResultsCSV() {
    try {
        const votes = await Storage.getVotes();
        if (votes.length === 0) return alert('No votes to download.');
        
        // Aggregate votes
        const results = {};
        Storage.config.positions.forEach(pos => {
            results[pos.title] = {};
            pos.candidates.forEach(c => {
                results[pos.title][c.name] = 0;
            });
        });
        
        votes.forEach(v => {
            if (!v.selections) return;
            v.selections.forEach(sel => {
                if (results[sel.position]) {
                    if (results[sel.position][sel.name] !== undefined) {
                        results[sel.position][sel.name]++;
                    } else {
                        results[sel.position][sel.name] = 1;
                    }
                }
            });
        });
        
        let csv = 'Position,Candidate,Votes\n';
        Object.keys(results).forEach(posTitle => {
            const candsArray = Object.keys(results[posTitle]).map(name => ({
                name: name,
                votes: results[posTitle][name]
            }));
            candsArray.sort((a, b) => b.votes - a.votes);
            
            candsArray.forEach(c => {
                csv += `"${posTitle}","${c.name}","${c.votes}"\n`;
            });
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'election_results.csv';
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    } catch (e) {
        alert('Error downloading CSV: ' + e.message);
    }
}

async function resetElection(e) {
    const btn = e.target;
    if (btn.textContent === 'Reset Election') {
        btn.textContent = 'Confirm Reset?';
        btn.style.backgroundColor = '#dc2626'; // Darker red
        setTimeout(() => {
            if (btn) {
                btn.textContent = 'Reset Election';
                btn.style.backgroundColor = '';
            }
        }, 3000);
        return;
    }

    try {
        btn.textContent = 'Resetting...';
        await Storage.resetElection();
        await refreshVotes();
        btn.textContent = 'Reset Election';
        btn.style.backgroundColor = '';
        // Small delay for UX so they see it resets before the alert blocks
        setTimeout(() => alert('Election reset successfully.'), 100);
    } catch (err) {
        alert('Error resetting election: ' + err.message);
        btn.textContent = 'Reset Election';
        btn.style.backgroundColor = '';
    }
}
