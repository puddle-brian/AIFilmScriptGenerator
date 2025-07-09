# Batch Voice Generation

This system allows you to generate voice audio for all scenes in your screenplay at once, instead of processing them individually through the UI.

## Prerequisites

1. **ElevenLabs API Key**: Set your ElevenLabs API key in your environment
2. **Database**: Your project must be saved in the database with dialogue generated
3. **Node.js**: Scripts run on Node.js

## Setup

### 1. Set Environment Variables

Make sure your `.env` file contains:
```
ELEVENLABS_API_KEY=your_api_key_here
DATABASE_URL=your_database_connection_string
```

### 2. Get Available Voices

First, see what voices are available:

```bash
node list-voices.js
```

This will show you all available ElevenLabs voices with their IDs, descriptions, and characteristics.

### 3. Configure Batch Generation

Edit `run-batch-voice.js` and update the `CONFIG` section:

```javascript
const CONFIG = {
    username: 'your_username',           // Your login username
    projectPath: 'your_project_path',    // Your project name
    
    // Voice assignments - Map character names to ElevenLabs voice IDs
    voiceAssignments: {
        'ALICE': 'EXAVITQu4vr4xnSDxMaL',      // Bella
        'BOB': 'pNInz6obpgDQGcFmaJgB',        // Adam
        'CHARLIE': 'IKne3meq5aSn9XLyUdCD',    // Charlie
        'NARRATOR': 'ThT5KcBeYPX3keUQqHPh',   // Dorothy
        // Add more character-to-voice mappings as needed
    },
    
    // Voice settings
    voiceSettings: {
        model: 'eleven_turbo_v2_5',    // Use cheaper Turbo model (50% cheaper)
        stability: 0.6,                 // Voice stability (0.0-1.0)
        similarityBoost: 0.8,           // Similarity boost (0.0-1.0)
        styleExaggeration: 0.2,         // Style exaggeration (0.0-1.0)
        speakerBoost: true              // Speaker boost (true/false)
    },
    
    pauseDuration: 1.0                  // Pause between dialogue lines (seconds)
};
```

**Important**: Character names must match exactly what appears in your screenplay dialogue (usually ALL CAPS).

## Running Batch Generation

### 1. Test with a Few Scenes First

Before processing all 80 scenes, test with a smaller batch to ensure your voice assignments and settings are correct.

### 2. Run the Batch Process

```bash
node run-batch-voice.js
```

The script will:
1. Load your project from the database
2. Find all scenes with dialogue
3. Extract character names from each scene
4. Generate voice audio for each dialogue line
5. Save individual audio files organized by scene
6. Create a summary report

### 3. Monitor Progress

The script provides detailed logging:
- Shows which scenes are being processed
- Displays character extraction results
- Reports generation progress
- Estimates costs and duration

## Output

Generated files are saved to `./batch_audio_output/`:

```
batch_audio_output/
├── scene_1/
│   ├── scene_1_ALICE_0.mp3
│   ├── scene_1_BOB_1.mp3
│   └── metadata.json
├── scene_2/
│   ├── scene_2_CHARLIE_0.mp3
│   └── metadata.json
└── batch_summary.json
```

## Cost Estimation

With your 80 scenes (roughly 320,000 characters):

- **Using Turbo Models**: ~160,000 credits = ~$24
- **Using Standard Models**: ~320,000 credits = ~$48

The script provides real-time cost tracking and final estimates.

## Troubleshooting

### Common Issues

1. **"No voice assigned to character"**: Check that character names in `voiceAssignments` match exactly what's in your screenplay
2. **"User not found"**: Verify your `username` in the config
3. **"Project not found"**: Verify your `projectPath` in the config
4. **API Rate Limits**: The script includes 2-second delays between scenes to avoid rate limiting

### Getting Character Names

If you're unsure about character names in your screenplay, the script will log them during processing. You can also check your generated dialogues in the database or UI.

### Voice ID Format

Voice IDs are long strings like `EXAVITQu4vr4xnSDxMaL`. Use the `list-voices.js` script to get the correct format.

## Advanced Configuration

### Pause Duration

Adjust `pauseDuration` to control silence between dialogue lines:
- `0.5` = Half second (fast-paced)
- `1.0` = One second (natural)
- `2.0` = Two seconds (dramatic)

### Voice Models

Available models (in order of cost):
- `eleven_turbo_v2_5` (cheapest, 50% discount)
- `eleven_turbo_v2` (cheap, 50% discount)
- `eleven_multilingual_v2` (standard price)
- `eleven_monolingual_v1` (standard price)

### Batch Processing

The script processes scenes sequentially to avoid overwhelming the API. For faster processing (if you have higher API limits), you can modify the code to process multiple scenes in parallel.

## Support

If you encounter issues:
1. Check the console output for specific error messages
2. Verify your API key and database connection
3. Ensure your project has generated dialogue
4. Test with a small number of scenes first 