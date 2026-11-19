# Aarohi AI Recruiter Service - Cost Optimization Architecture

## 1. Cost Drivers in Real-Time Voice AI

In a real-time conversational voice interview system, operational expenses are driven by four primary vectors:

1. **LLM Generation Tokens**: Prompt tokens + output tokens for each conversational turn.
2. **Speech-to-Text (STT) Audio Minutes**: Continuous audio stream transcription.
3. **Text-to-Speech (TTS) Character Count**: Synthesized audio response characters.
4. **WebRTC Infrastructure**: LiveKit egress/ingress bandwidth.

---

## 2. Optimization Strategies Implemented

### 1. Deterministic Application Logic Over LLM Calls
- **Stage Transitions**: Governed by deterministic backend Python code. The LLM is never queried to determine "Is this interview ready for technical questions?".
- **Fixed Boilerplate Phrases**: Stage intros ("Welcome to the interview", "Do you have any questions for me?", closing statements) use pre-synthesized or templated text rather than invoking LLM generation.
- **Repeat / Clarify Logic**: Standard repetition requests ("Could you repeat that?") reuse cached prompt buffers without calling the LLM.

### 2. Fast, Cost-Effective Model Selection
- Primary LLM: **Google Gemini 2.0 Flash**. Gemini 2.0 Flash delivers superior speed, multi-lingual Hinglish comprehension, and an order of magnitude lower cost per million tokens compared to heavy flagship models.

### 3. Hard Safety Limits & Budgeting Guardrails
- **Max Interview Duration**: Defaults to 45 minutes (`BUDGET__MAX_INTERVIEW_DURATION_MINUTES`). The system automatically concludes sessions exceeding this duration to prevent runaway audio costs.
- **Max Tokens Per Interview**: Hard cap of 15,000 tokens (`BUDGET__MAX_TOKENS_PER_INTERVIEW`).
- **Max Audio Stream Cap**: Capped at 50 minutes (`BUDGET__MAX_AUDIO_MINUTES_PER_INTERVIEW`).
- **Concurrency Limiting**: Built-in capacity ceiling (`BUDGET__MAX_CONCURRENT_INTERVIEWS=20`) to protect against denial-of-wallet spikes.

---

## 3. Estimated Cost Per 30-Minute Interview

| Component | Provider / Model | Unit Cost | Units per 30-min Interview | Cost per Interview |
|---|---|---|---|---|
| **STT** | Deepgram Nova-2 | \$0.0043 / min | 30 minutes | ~\$0.13 |
| **LLM** | Gemini 2.0 Flash | ~\$0.10 / 1M tokens | ~12,000 tokens | ~\$0.0012 |
| **TTS** | Cartesia Sonic | \$0.075 / 1K chars | ~5,000 chars | ~\$0.37 |
| **LiveKit Bandwidth**| LiveKit Cloud / Self-hosted | ~\$0.004 / GB | ~15 MB audio stream | ~\$0.01 |
| **Total Estimated Cost** | | | | **~\$0.51 / interview** |

*Note: By keeping Aarohi's spoken turns concise and professional, TTS costs are minimized, achieving a total direct COGS of approximately \$0.50 per comprehensive 30-minute interview.*
