const Storage = {
    config: null,
    
    async init() {
        try {
            // Use cache-busting timestamp and no-store headers to guarantee fresh data
            const res = await fetch(`config.json?t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            this.config = await res.json();
            
            const localConfig = localStorage.getItem('election_config');
            if (localConfig) {
                this.config = JSON.parse(localConfig);
            }
        } catch (e) {
            console.error("Failed to load config.json", e);
        }
    },

    isGoogleConfigured() {
        return this.config && this.config.googleAppUrl && this.config.googleAppUrl.trim() !== '';
    },

    async apiCall(action, payload = {}) {
        payload.action = action;
        const response = await fetch(this.config.googleAppUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Google Apps Script request failed");
        const res = await response.json();
        if (res.error) throw new Error(res.error);
        return res;
    },

    async getVotes() {
        if (this.isGoogleConfigured()) {
            return await this.apiCall('getVotes');
        } else {
            const votes = localStorage.getItem('election_votes');
            return votes ? JSON.parse(votes) : [];
        }
    },

    async saveVote(voteRecord) {
        if (this.isGoogleConfigured()) {
            const votes = await this.getVotes();
            if (votes.some(v => v.flatNumber.toLowerCase() === voteRecord.flatNumber.toLowerCase())) {
                throw new Error("You have already voted. If you believe this is an error, contact the admin.");
            }
            await this.apiCall('addVote', { vote: voteRecord });
        } else {
            const votes = await this.getVotes();
            if (votes.some(v => v.flatNumber.toLowerCase() === voteRecord.flatNumber.toLowerCase())) {
                throw new Error("You have already voted. If you believe this is an error, contact the admin.");
            }
            votes.push(voteRecord);
            localStorage.setItem('election_votes', JSON.stringify(votes));
        }
    },

    async updateConfig(newConfig) {
        localStorage.setItem('election_config', JSON.stringify(newConfig));
        this.config = newConfig;
    },

    async deleteVote(flatNumber) {
        if (this.isGoogleConfigured()) {
            await this.apiCall('deleteVote', { flatNumber: flatNumber.toLowerCase(), password: this.config.adminPassword });
        } else {
            const votes = await this.getVotes();
            const filtered = votes.filter(v => v.flatNumber.toLowerCase() !== flatNumber.toLowerCase());
            localStorage.setItem('election_votes', JSON.stringify(filtered));
        }
    },

    async resetElection() {
        if (this.isGoogleConfigured()) {
            await this.apiCall('resetVotes', { password: this.config.adminPassword });
        } else {
            localStorage.removeItem('election_votes');
        }
    },

    async adminLogin(password) {
        if (this.isGoogleConfigured()) {
            const res = await this.apiCall('verifyAdmin', { password: password });
            if (!res.success) throw new Error("Incorrect password.");
            this.config.adminPassword = password; // Save valid password for future requests
        } else {
            if (password !== this.config.adminPassword) {
                throw new Error("Incorrect password.");
            }
        }
        return true;
    }
};
