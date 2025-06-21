# Setup Instructions for Claude Integration

## Why Claude?

Claude 3.5 Sonnet is excellent for creative writing tasks like screenplay generation because:
- Superior creative writing capabilities
- Better understanding of story structure and character development
- More nuanced dialogue generation
- Better at following specific formatting requirements
- Generally more reliable for creative/artistic content

## Quick Setup

1. **Get Your Anthropic API Key**
   - Go to [console.anthropic.com](https://console.anthropic.com/)
   - Create an account or sign in
   - Go to API Keys section
   - Create a new API key
   - Copy the key (starts with `sk-ant-`)

2. **Create Environment File**
   Create a `.env` file in your project root:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here
   PORT=3000
   NODE_ENV=development
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Start the Application**
   ```bash
   npm run dev
   ```

## What Changed

- Replaced OpenAI SDK with Anthropic SDK
- Updated all API calls to use Claude 3.5 Sonnet
- Modified prompts to work optimally with Claude
- Updated environment variables and documentation

## Benefits of Using Claude

- **Better Creative Writing**: Claude excels at creative tasks like screenwriting
- **Improved Dialogue**: More natural, character-specific dialogue generation
- **Better Story Structure**: Superior understanding of narrative flow
- **Consistent Formatting**: Better at maintaining screenplay format conventions
- **Cost Effective**: Generally more cost-effective for creative writing tasks

## API Limits & Pricing

- Claude 3.5 Sonnet: ~$3 per million input tokens, ~$15 per million output tokens
- Rate limits: 4000 requests per minute (much higher than OpenAI for most users)
- Generally more generous rate limits for creative applications

## Model Details

Using **Claude 3.5 Sonnet** (model: `claude-3-5-sonnet-20241022`) which offers:
- 200K context window
- Excellent creative writing capabilities
- Strong instruction following
- Reliable JSON output formatting
- Superior dialogue generation

Your Film Script Generator is now powered by Claude and ready to create amazing scripts! 