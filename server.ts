import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Mock ABAIR API (Text-to-Speech)
app.post('/api/tts', async (req, res) => {
  const { text, voice = 'ga_UL_an_triail_flite_v2' } = req.body;
  
  try {
    // In a real implementation, you would call ABAIR API here
    // const response = await axios.post('https://abair.ie/api/v2/synthesis', { text, voice });
    // res.json(response.data);
    
    // For now, return a mock URL or success message
    console.log(`Synthesizing text: ${text} with voice: ${voice}`);
    res.json({ 
      success: true, 
      audioUrl: 'https://www.abair.ie/api/public/demo/audio/ga_UL_an_triail_flite_v2.mp3', // Example URL
      text 
    });
  } catch (error) {
    console.error('TTS Error:', error);
    res.status(500).json({ error: 'Failed to synthesize speech' });
  }
});

// Mock Gaelspell/Grammar API
app.post('/api/grammar', (req, res) => {
  const { text } = req.body;
  
  // Simple mock grammar check
  const corrections = [];
  if (text.toLowerCase().includes('failte')) {
    corrections.push({
      original: 'failte',
      suggestion: 'fáilte',
      explanation: 'Missing fada on "a"'
    });
  }
  
  res.json({ corrections });
});

// Chat completion (Mock OpenAI/Anthropic)
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  
  // Simple response logic for demonstration
  let reply = "Dia duit! Conas atá tú?";
  if (message.toLowerCase().includes('conas')) {
    reply = "Tá mé go maith, go raibh maith agat. Agus tú féin?";
  } else if (message.toLowerCase().includes('maith')) {
    reply = "Is maith sin a chloisteáil!";
  }
  
  res.json({ reply });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
