// Data loader utility for external JSON files
class DataLoader {
    constructor() {
        this.cache = {};
    }

    async loadJSON(filename) {
        if (this.cache[filename]) {
            return this.cache[filename];
        }

        try {
            const response = await fetch(`/data/${filename}`);
            if (!response.ok) {
                throw new Error(`Failed to load ${filename}: ${response.status}`);
            }
            const data = await response.json();
            this.cache[filename] = data;
            return data;
        } catch (error) {
            console.error(`Error loading ${filename}:`, error);
            return [];
        }
    }

    async loadAllData() {
        const [directors, screenwriters, films, tones] = await Promise.all([
            this.loadJSON('directors.json'),
            this.loadJSON('screenwriters.json'),
            this.loadJSON('films.json'),
            this.loadJSON('tones.json')
        ]);

        return {
            directors,
            screenwriters,
            films,
            tones
        };
    }
}

// Create global instance
window.dataLoader = new DataLoader(); 