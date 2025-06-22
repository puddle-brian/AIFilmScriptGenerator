# Film Script Generator

A hierarchical story development system that uses progressive prompt refinement to guide users from high-level story concepts to detailed screenplay content.

## Features

### Core Workflow
1. **Story Input** - Define concept, characters, influences, and tone
2. **Template Selection** - Choose from proven narrative structures
3. **Acts Generation** - Create structured story acts
4. **Plot Points** - Generate causal story beats
5. **Scenes** - Develop detailed scene descriptions
6. **Dialogue** - Generate professional screenplay dialogue
7. **Export** - Output in multiple formats

### ✨ New: Inline Content Editing
All generated content (Acts, Plot Points, Scenes, and Dialogue) now supports inline editing:

- **Click "Edit"** on any generated content block to modify it
- **Real-time editing** with syntax highlighting for different content types
- **Auto-save** - Changes are saved to both the project files and hierarchical context
- **Maintains coherence** - Edited content is used in subsequent generation steps
- **Visual feedback** - Clear indication of edit mode vs. view mode
- **Undo support** - Cancel changes to revert to original content

#### How It Works
- **Acts**: Edit name, description, and character development notes
- **Plot Points**: Modify individual plot points or reorder them
- **Scenes**: Update titles, locations, times, and descriptions
- **Dialogue**: Edit the full screenplay dialogue directly

All edits maintain the hierarchical context system, ensuring that subsequent AI generations build upon your modified content.

## Technical Architecture

The system uses a 5-level hierarchical context architecture:
1. **Story Foundation** - Core concept and influences
2. **Structure Template** - Narrative framework
3. **Generated Story Acts** - Specific story structure
4. **Plot Points** - Causal story beats
5. **Individual Scenes** - Detailed scene implementation

## Setup

1. Install dependencies: `npm install`
2. Add your Anthropic API key to `.env`: `ANTHROPIC_API_KEY=your_key_here`
3. Start the server: `npm start`
4. Open `http://localhost:3000`

## API Endpoints

### Content Editing
- `PUT /api/edit-content/acts/:projectPath/:actKey` - Save edited act content
- `PUT /api/edit-content/plot-points/:projectPath/:actKey` - Save edited plot points
- `PUT /api/edit-content/scenes/:projectPath/:actKey/:sceneIndex` - Save edited scene
- `PUT /api/edit-content/dialogue/:projectPath/:actKey/:sceneIndex` - Save edited dialogue

### Generation
- `POST /api/generate-structure` - Generate story acts
- `POST /api/generate-plot-points-for-act/:projectPath/:actKey` - Generate plot points
- `POST /api/generate-scenes-for-element/:projectPath/:actKey` - Generate scenes
- `POST /api/generate-dialogue` - Generate screenplay dialogue

## File Structure

```
generated/
  [ProjectName]/
    01_context/
      context.json          # Complete hierarchical context
      story-input.json      # Level 1 data
      story-acts.json       # Level 3 data
    02_plot-points/
      [act].json            # Level 4 data per story act
    03_scenes/
      [act]/                # Level 5 data per story act
        scene-[n].json
    04_dialogue/
      [act]/
        scene-[n].json
```

## Supported Export Formats

- Professional Screenplay (PDF-ready)
- Fountain Format
- Final Draft Format
- Plain Text
- Production Package (with character/location breakdowns)

---

The Film Script Generator maintains narrative coherence through its hierarchical context system while giving you full creative control through inline editing capabilities.

## Features

- **Story Concept Input**: Capture title, genre, logline, characters, and tone
- **Plot Structure Templates**: Choose from Three-Act, Hero's Journey, or Save the Cat structures
- **Hierarchical Workflow**: Progressive development from Structure → Scenes → Dialogue
- **User Approval System**: Review and approve content at each level before proceeding
- **AI-Powered Generation**: Uses Claude 3.5 Sonnet for intelligent content creation
- **Live Script Assembly**: Real-time preview of the developing script
- **Export Functionality**: Download completed scripts in text or JSON format
- **Project Persistence**: Save and load projects for continued work

### Hierarchical Story Development
- **Story Foundation**: Define your story concept, characters, tone, and creative influences
- **Template Selection**: Choose from proven narrative structure templates (Hero's Journey, Three-Act, Save the Cat, etc.)  
- **Structure Generation**: Generate a detailed plot structure tailored to your story
- **Plot Points Preview**: **NEW!** Preview and understand the context/prompt used to generate plot points for each structural element
- **Plot Points Generation**: Create causal story beats that connect structural elements
- **Scene Generation**: Generate detailed scenes based on plot points
- **Dialogue Creation**: Generate screenplay-format dialogue for each scene
- **Script Export**: Export your completed screenplay in multiple formats

### Plot Points Context Preview

You can now preview the exact hierarchical context and prompt that will be used to generate plot points for any structural element:

1. **Navigate to Step 4: Plot Points**
2. **Click "🔍 Preview Prompt"** next to any structural element
3. **View the complete hierarchical context** including:
   - Story Foundation (title, logline, characters, tone, influences)
   - Overall Story Structure (selected template and generated structure)
   - Current Structural Element (purpose, character development)
   - Specific generation requirements for plot points
4. **Understand the AI instructions** that ensure causal "and then"/"therefore" logic
5. **See how the context builds hierarchically** from story concept to specific plot beats

This preview helps you understand:
- How your story foundation influences plot point generation
- What creative influences and tone are being applied
- How the structural element's purpose guides the plot points
- The specific requirements for causal narrative flow
- The complete context that ensures hierarchical coherence

The preview shows the exact same prompt and system message that will be sent to the AI, giving you full transparency into the generation process.

## Installation

1. **Clone or create the project directory**
   ```bash
   mkdir film-script-generator
   cd film-script-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```
   
   Or for production:
   ```bash
   npm start
   ```

5. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## Usage

### Step 1: Story Input
- Enter your story title, genre, and logline
- Describe your main characters
- Select the desired tone/style

### Step 2: Template Selection
- Choose from available plot structure templates:
  - **Three-Act Structure**: Classic setup, confrontation, resolution
  - **Hero's Journey**: Joseph Campbell's monomyth
  - **Save the Cat**: Blake Snyder's 15-beat structure

### Step 3: Structure Review
- Review the AI-generated plot structure
- Edit or regenerate as needed
- Approve to proceed to scene generation

### Step 4: Scene Breakdown
- Review individual scenes for each structural element
- Each scene includes location, timing, and character details
- Approve scenes to proceed to dialogue generation

### Step 5: Dialogue Generation
- Generate screenplay dialogue for each scene
- Review and edit the generated content
- Scenes are formatted in proper screenplay format

### Step 6: Final Script & Export
- Preview the complete assembled script
- Export as text file or JSON project file
- Save project for future editing

## Project Structure

```
film-script-generator/
├── package.json
├── server.js
├── .env
├── README.md
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   └── favicon.ico
├── templates/
│   ├── three-act.json
│   ├── hero-journey.json
│   └── save-the-cat.json
└── generated/
    └── [project-specific folders]
```

## API Endpoints

- `GET /api/templates` - Get available plot structure templates
- `POST /api/generate-structure` - Generate high-level plot structure
- `POST /api/generate-scenes` - Generate scenes for approved structure
- `POST /api/generate-dialogue` - Generate dialogue for approved scenes
- `POST /api/save-project` - Save project state
- `GET /api/project/:id` - Load saved project
- `POST /api/export` - Export final script

## Technologies Used

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **AI Integration**: Anthropic Claude 3.5 Sonnet API
- **Storage**: JSON files (filesystem-based)
- **Styling**: Custom CSS with modern design patterns

## Configuration

### Environment Variables

- `ANTHROPIC_API_KEY`: Your Anthropic API key (required)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

### Template Customization

You can add custom plot structure templates by creating JSON files in the `templates/` directory. Each template should follow this structure:

```json
{
  "name": "Template Name",
  "description": "Brief description of the template",
  "structure": {
    "element_key": {
      "name": "Element Name",
      "description": "What happens in this element",
      "elements": ["Key", "Story", "Points"]
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **API Key Errors**
   - Ensure your Anthropic API key is correctly set in the `.env` file
   - Verify the API key has sufficient credits

2. **Template Loading Issues**
   - Check that template JSON files are valid
   - Ensure the `templates/` directory exists and is readable

3. **Project Saving Issues**
   - Verify the `generated/` directory exists and is writable
   - Check filesystem permissions

### Error Messages

- "Error loading templates" - Check template files and API connectivity
- "Failed to generate structure" - Verify API key and network connection
- "No script to export" - Complete at least one dialogue scene before exporting

## Development

### Adding New Features

1. **New Template Types**: Add JSON files to `templates/` directory
2. **Custom Export Formats**: Modify the `/api/export` endpoint
3. **Enhanced UI**: Update `public/styles.css` and `public/index.html`
4. **Additional AI Models**: Modify the Anthropic configuration in `server.js`

### Testing

The application includes basic error handling and user feedback. For production use, consider adding:

- Unit tests for API endpoints
- Integration tests for the workflow
- Load testing for AI generation endpoints
- Error monitoring and logging

## Future Enhancements

- **Database Integration**: Replace JSON files with MongoDB/PostgreSQL
- **User Authentication**: Add user accounts and project sharing
- **Collaboration Features**: Multi-user editing capabilities
- **Advanced Export Options**: PDF, Final Draft, Fountain formats
- **Character Development Tools**: Dedicated character creation workflows
- **Genre-Specific Templates**: Specialized templates for different genres
- **AI Model Selection**: Choose between different AI models
- **Professional Formatting**: Industry-standard script formatting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the API documentation
3. Check the browser console for errors
4. Ensure all dependencies are installed correctly

## Acknowledgments

- Anthropic for Claude 3.5 Sonnet API
- Blake Snyder for the "Save the Cat" structure
- Joseph Campbell for the Hero's Journey
- The screenwriting community for structural insights 