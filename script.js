let selectedCandidates = [];
let voterInfo = { name: '', flatNumber: '' };

document.addEventListener('DOMContentLoaded', async () => {
    await Storage.init();
    applyTheme();
    setupUI();
    startCountdown();
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

function setupUI() {
    if (!Storage.config) return;
    const cfg = Storage.config;
    document.getElementById('apartment-name').textContent = cfg.apartmentName;
    document.getElementById('election-banner').textContent = cfg.electionBanner;

    document.getElementById('start-voting-btn').addEventListener('click', async () => {
        const name = document.getElementById('voter-name').value.trim();
        const flat = document.getElementById('flat-number').value.trim();

        if (!name || !flat) {
            document.getElementById('voter-error').textContent = 'Please fill in both Name and Flat Number.';
            return;
        }

        const btn = document.getElementById('start-voting-btn');
        btn.textContent = 'Checking...';
        btn.disabled = true;

        try {
            const votes = await Storage.getVotes();
            const alreadyVoted = votes.some(v => v.flatNumber.toLowerCase() === flat.toLowerCase());
            if (alreadyVoted) {
                document.getElementById('voter-error').textContent = 'This Flat Number has already voted. Contact Admin if you need help';
                btn.textContent = 'Proceed to Vote';
                btn.disabled = false;
                return;
            }
        } catch (e) {
            console.error('Error fetching votes:', e);
        }

        btn.textContent = 'Proceed to Vote';
        btn.disabled = false;

        voterInfo.name = name;
        voterInfo.flatNumber = flat;
        document.getElementById('voter-error').textContent = '';

        document.getElementById('voter-details-card').classList.add('hidden');
        document.getElementById('voting-section').classList.remove('hidden');
        document.getElementById('selection-bar').classList.remove('hidden');

        renderPositions();
    });

    document.getElementById('submit-vote-btn').addEventListener('click', submitVote);
}

function renderPositions() {
    const container = document.getElementById('positions-container');
    container.innerHTML = '';

    Storage.config.positions.forEach(pos => {
        if (!pos.candidates || pos.candidates.length === 0) return;

        const posBlock = document.createElement('div');
        posBlock.className = 'position-block glass-card mb-1';

        const title = document.createElement('h3');
        title.className = 'position-title';
        title.textContent = pos.title;
        posBlock.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'candidates-grid';

        pos.candidates.forEach(cand => {
            const card = document.createElement('div');
            card.className = 'candidate-card';
            card.dataset.id = cand.id;
            card.dataset.name = cand.name;
            card.dataset.position = pos.title;

            const img = document.createElement('img');
            img.className = 'candidate-photo';
            img.src = cand.photo || 'https://via.placeholder.com/150?text=No+Photo';
            img.alt = cand.name;

            const nameEl = document.createElement('div');
            nameEl.className = 'candidate-name';
            nameEl.textContent = cand.name;

            const descEl = document.createElement('div');
            descEl.className = 'candidate-desc';
            descEl.textContent = cand.description;

            card.appendChild(img);
            card.appendChild(nameEl);
            card.appendChild(descEl);

            card.addEventListener('click', () => toggleSelection(card, cand, pos));

            grid.appendChild(card);
        });

        posBlock.appendChild(grid);
        container.appendChild(posBlock);
    });
}

function toggleSelection(card, candidate, position) {
    const index = selectedCandidates.findIndex(c => c.id === candidate.id);

    if (index > -1) {
        selectedCandidates.splice(index, 1);
        card.classList.remove('selected');
    } else {
        const positionCount = selectedCandidates.filter(c => c.position === position.title).length;
        if (positionCount >= 2) {
            alert(`You can only select up to 2 candidates for ${position.title}.`);
            return;
        }
        selectedCandidates.push({
            id: candidate.id,
            name: candidate.name,
            position: position.title
        });
        card.classList.add('selected');
    }

    updateSelectionBar();
}

function updateSelectionBar() {
    const count = selectedCandidates.length;
    document.getElementById('selection-count').textContent = count;

    const submitBtn = document.getElementById('submit-vote-btn');
    if (count > 0) {
        submitBtn.removeAttribute('disabled');
    } else {
        submitBtn.setAttribute('disabled', 'true');
    }
}

async function submitVote() {
    const submitBtn = document.getElementById('submit-vote-btn');
    submitBtn.textContent = 'Submitting...';
    submitBtn.setAttribute('disabled', 'true');

    const voteRecord = {
        name: voterInfo.name,
        flatNumber: voterInfo.flatNumber,
        timestamp: new Date().toISOString(),
        selections: selectedCandidates
    };

    try {
        await Storage.saveVote(voteRecord);
        showSuccess();
    } catch (e) {
        alert(e.message || 'Error submitting vote');
        submitBtn.textContent = 'Submit Vote';
        submitBtn.removeAttribute('disabled');
    }
}

function showSuccess() {
    document.getElementById('voting-section').classList.add('hidden');
    document.getElementById('selection-bar').classList.add('hidden');
    document.getElementById('success-section').classList.remove('hidden');

    // Confetti animation
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
}

function startCountdown() {
    const endDate = new Date(Storage.config.votingCloses).getTime();
    if (isNaN(endDate)) return;

    const timerEl = document.getElementById('countdown-timer');

    const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = endDate - now;
        if (distance < 0) {
            clearInterval(interval);
            timerEl.textContent = "Voting Closed";
            document.getElementById('start-voting-btn')?.setAttribute('disabled', 'true');
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        timerEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }, 1000);
}
