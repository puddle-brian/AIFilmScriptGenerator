// Data loader utility for external JSON files
class DataLoader {
    constructor() {
        this.cache = {};
    }

    async loadJSON(filename) {
        console.log(`DataLoader: Attempting to load ${filename}`);
        
        if (this.cache[filename]) {
            console.log(`DataLoader: Using cached ${filename}`);
            return this.cache[filename];
        }

        try {
            console.log(`DataLoader: Fetching /data/${filename}`);
            const response = await fetch(`/data/${filename}`);
            console.log(`DataLoader: Response status for ${filename}: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load ${filename}: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`DataLoader: Successfully loaded ${filename}, ${data.length} items`);
            this.cache[filename] = data;
            return data;
        } catch (error) {
            console.error(`DataLoader: Error loading ${filename}:`, error);
            // Return empty array instead of undefined
            return [];
        }
    }

    async loadAllData() {
        console.log('DataLoader: Loading all data files...');
        
        try {
            const [directors, screenwriters, films, tones] = await Promise.all([
                this.loadJSON('directors.json'),
                this.loadJSON('screenwriters.json'),
                this.loadJSON('films.json'),
                this.loadJSON('tones.json')
            ]);

            console.log('DataLoader: All data loaded successfully:', {
                directors: directors.length,
                screenwriters: screenwriters.length,
                films: films.length,
                tones: tones.length
            });

            return {
                directors,
                screenwriters,
                films,
                tones
            };
        } catch (error) {
            console.error('DataLoader: Error in loadAllData:', error);
            // Return empty arrays for all data types
            return {
                directors: [],
                screenwriters: [],
                films: [],
                tones: []
            };
        }
    }
}

// Create global instance
console.log('DataLoader: Creating global instance');
window.dataLoader = new DataLoader(); 