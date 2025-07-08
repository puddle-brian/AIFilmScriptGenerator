# 🎙️ Voice Generation Setup Guide

## Quick Setup (Next Steps)

Since you've already added your `ELEVENLABS_API_KEY` to the `.env` file, you just need to:

### 1. Install the New Dependency
```bash
npm install archiver
```

### 2. Restart Your Server
```bash
npm start
```

### 3. Test the Voice Generation
1. Go to **Step 6: Dialogue Generation** in your Film Script Generator
2. Generate dialogue for any scene (if you haven't already)
3. Look for the new **🎙️ Voice** button next to each scene with dialogue
4. Click it to start the voice generation process

## How It Works

### Scene-by-Scene Voice Generation
- Each dialogue scene gets its own **🎙️ Voice** button
- Voice generation only appears after dialogue is generated
- Creates line-by-line audio assembly (like a real audio drama)

### Voice Assignment Process
1. **Character Detection**: Automatically finds all characters in the scene
2. **Voice Selection**: Choose different ElevenLabs voices for each character
3. **Narrator Voice**: Optional voice for scene directions and action lines
4. **Auto-Assignment**: One-click to automatically assign voices

### Audio Output
- **Individual Segments**: Each line of dialogue as separate audio
- **Scene Playback**: Combined audio playing in sequence with pauses
- **Download Options**: Individual files or ZIP package

## Features

✅ **Multi-Character Support**: Different voices for each character  
✅ **Screenplay Parser**: Automatically extracts dialogue from screenplay format  
✅ **Line-by-Line Assembly**: Creates proper audio drama experience  
✅ **Voice Preview**: Test voices before generating full scene  
✅ **Auto-Assignment**: Quick voice assignment for multiple characters  
✅ **Pause Control**: Customizable pauses between lines  
✅ **Download Support**: Save audio files for external use  

## Example Usage

1. **Generate Dialogue**: Complete Step 6 as normal
2. **Click Voice Button**: Press 🎙️ Voice on any scene
3. **Assign Voices**: Select different voices for each character
4. **Preview**: Test voices with sample dialogue
5. **Generate**: Create line-by-line audio for the entire scene
6. **Play/Download**: Listen to your audio drama or save files

## Cost Considerations

ElevenLabs charges per character generated:
- **Typical dialogue scene**: 500-1500 characters
- **Estimated cost per scene**: $0.50-$2.00
- **Feature film estimate**: $20-60 total

## Technical Notes

- Voice generation is completely optional - dialogue works exactly the same without it
- Audio files are temporarily stored on your server
- Uses your existing ElevenLabs API key
- Integrates seamlessly with your existing workflow

---

## 🚀 Ready to Test!

After running `npm install archiver` and restarting your server, go to Step 6 and generate some dialogue. You'll see the new voice buttons appear automatically!

The system creates immersive audio drama experiences from your screenplay dialogue with proper character voices and natural pacing. 