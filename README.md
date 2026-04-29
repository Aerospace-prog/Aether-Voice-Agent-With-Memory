# Voice AI Agent with Memory

A voice-enabled AI agent system that combines natural language conversation with tool-based task management and persistent memory. Users interact through voice, and the agent intelligently decides whether to respond conversationally or invoke tools for to-do list management and memory operations.

## Features

- **Voice Interface**: Natural voice input/output using OpenAI Whisper (STT) and TTS
- **Intelligent Agent**: LLM-based orchestrator with tool-calling capabilities
- **To-Do Management**: Create, read, update, and delete tasks via voice commands
- **Memory System**: Persistent memory across sessions for contextual conversations
- **Hands-Free Operation**: Complete voice-based interaction for accessibility

## Requirements

- Python 3.10 or higher
- OpenAI API key (for GPT-4, Whisper, and TTS)
- Microphone and speakers for voice interaction

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd voice-ai-agent-with-memory
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure API keys:
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

## Configuration

Edit the `.env` file to configure the system:

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `OPENAI_MODEL`: GPT model to use (default: gpt-4)
- `OPENAI_TTS_MODEL`: Text-to-speech model (default: tts-1)
- `OPENAI_TTS_VOICE`: TTS voice selection (default: alloy)
- `OPENAI_WHISPER_MODEL`: Speech-to-text model (default: whisper-1)
- `DATA_DIR`: Directory for storing to-dos and memories (default: ~/.voice-agent)

## Usage

### Running the Agent

Start in voice mode (requires microphone and speakers):
```bash
python demo.py
```

Start in text mode (no audio hardware required):
```bash
python demo.py --text-mode
```

### Example Voice Commands

**To-Do Management:**
- "Add a task to buy groceries"
- "What are my to-do items?"
- "Mark the first task as completed"
- "Delete the grocery task"

**Conversational:**
- "Hello, how are you?"
- "What can you help me with?"
- "Tell me about yourself"

**Memory:**
- "Remember that I prefer morning meetings"
- "I like to work in 2-hour focused blocks"
- "What do you know about my preferences?"
- "Do you remember what I told you about my schedule?"



## Project Structure

```
voice-ai-agent-with-memory/
├── demo.py                # CLI entry point
├── src/                    # Source code
│   ├── models.py          # Data models (ToDoItem, Memory, etc.)
│   ├── todo_manager.py    # To-do CRUD operations
│   ├── memory_system.py   # Memory storage and retrieval
│   ├── voice_interface.py # Voice input/output handling (STT/TTS)
│   ├── agent_core.py      # LLM agent with tool calling
│   ├── prompts.py         # System prompts
│   ├── config.py          # Configuration management
│   └── voice_agent.py     # Main application orchestrator
├── tests/                 # Test suite
│   ├── unit/             # Unit tests
│   ├── property/         # Property-based tests
│   └── integration/      # Integration tests
├── examples/              # Example scripts and demos
│   ├── voice_interface_demo.py  # VoiceInterface usage demo
│   └── semantic_search_demo.py  # Memory semantic search demo
├── data/                  # Data storage directory
├── requirements.txt       # Python dependencies
├── .env.example          # Example environment configuration
└── README.md             # This file
```

## Components

### VoiceInterface

The `VoiceInterface` class handles all voice input/output operations:

**Features:**
- Audio capture from microphone with silence detection
- Speech-to-text using OpenAI Whisper API
- Text-to-speech using OpenAI TTS API (coming in task 6.2)
- Comprehensive error handling for API failures

**Usage Example:**
```python
from src.voice_interface import VoiceInterface

# Initialize with API key
interface = VoiceInterface(api_key="your-openai-key")

# Capture audio (records until silence detected)
audio = interface.capture_audio()

# Or capture for fixed duration
audio = interface.capture_audio(duration=5.0)

# Convert speech to text
text = interface.speech_to_text(audio)
print(f"You said: {text}")
```

**Error Handling:**
- Returns empty string for empty or silent audio
- Raises `STTError` for API failures with descriptive messages
- Handles network errors, quota limits, and invalid API keys

See `examples/voice_interface_demo.py` for a complete demonstration.

## Running Tests

Run all tests:
```bash
pytest
```

Run specific test categories:
```bash
pytest tests/unit/          # Unit tests only
pytest tests/property/      # Property-based tests only
pytest tests/integration/   # Integration tests only
```

Run with coverage:
```bash
pytest --cov=src --cov-report=html
```

## Development

### Code Style

This project follows PEP 8 style guidelines. Use type hints for all function signatures.

## Troubleshooting

### Agent Issues

**Agent doesn't use tools:**
- Ensure your request clearly mentions a task action ("add", "list", "delete", "mark as done")
- The agent uses conversational responses for general questions

**Memory not persisting:**
- Check that DATA_DIR is writable
- Verify ~/.voice-agent/ directory exists after first run
- Check for IOError messages in the console output

### Audio Issues

**No microphone detected:**
- Check system audio settings
- Ensure microphone permissions are granted
- Try specifying a different audio device

**Poor speech recognition:**
- Speak clearly and at a moderate pace
- Reduce background noise
- Check microphone quality and positioning

### API Issues

**Rate limit errors:**
- Reduce request frequency
- Upgrade OpenAI API plan
- Implement request queuing

**Authentication errors:**
- Verify OPENAI_API_KEY in .env file
- Check API key validity on OpenAI dashboard
- Ensure no extra spaces in .env file

### Storage Issues

**Permission errors:**
- Check write permissions for DATA_DIR
- Ensure directory exists and is accessible
- Try using a different storage location

## Acknowledgments

- OpenAI for GPT-4, Whisper, and TTS APIs
- Hypothesis for property-based testing framework
