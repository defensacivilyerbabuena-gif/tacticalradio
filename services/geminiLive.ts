
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { ConnectionState } from "../types";
import { decode, decodeAudioData, createPcmBlob } from "../utils/audioUtils";

interface LiveServiceOptions {
  onConnectionUpdate: (state: ConnectionState) => void;
  onAudioData: (audioBuffer: AudioBuffer) => void;
  onTranscript: (text: string, isUser: boolean) => void;
  onLog: (msg: string) => void;
}

export class GeminiLiveService {
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private outputNode: GainNode | null = null;
  private stream: MediaStream | null = null;
  private nextStartTime: number = 0;
  private sources: Set<AudioBufferSourceNode> = new Set();

  public async connect(options: LiveServiceOptions) {
    try {
      options.onLog("CHECKING_AUTH...");
      
      // Verificación de API Key según lineamientos de Google
      if (!(await (window as any).aistudio.hasSelectedApiKey())) {
        options.onLog("API_KEY_REQUIRED");
        await (window as any).aistudio.openSelectKey();
      }

      options.onConnectionUpdate(ConnectionState.CONNECTING);
      options.onLog("INITIALIZING_RADIO_LINK...");

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.outputAudioContext.destination);

      options.onLog("REQUESTING_MIC_ACCESS...");
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'Eres Overlord, despachador táctico real. Mantén respuestas breves, estilo militar y profesional. Usa español siempre.',
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            options.onLog("LINK_ESTABLISHED_SECURE");
            options.onConnectionUpdate(ConnectionState.CONNECTED);
            this.startAudioStreaming();
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.find(p => p.inlineData)?.inlineData?.data;
            if (base64Audio && this.outputAudioContext && this.outputNode) {
              this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
              const audioBytes = decode(base64Audio);
              const audioBuffer = await decodeAudioData(audioBytes, this.outputAudioContext, 24000, 1);
              const source = this.outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(this.outputNode);
              source.start(this.nextStartTime);
              this.nextStartTime += audioBuffer.duration;
              this.sources.add(source);
              options.onAudioData(audioBuffer);
            }

            if (message.serverContent?.outputTranscription?.text) {
              options.onTranscript(message.serverContent.outputTranscription.text, false);
            }
          },
          onclose: () => {
            options.onLog("LINK_TERMINATED");
            options.onConnectionUpdate(ConnectionState.DISCONNECTED);
          },
          onerror: (err) => {
            console.error(err);
            options.onLog(`ERROR: ${err.message || 'COMM_FAILURE'}`);
            options.onConnectionUpdate(ConnectionState.ERROR);
          }
        }
      });
    } catch (error: any) {
      options.onLog(`CRITICAL: ${error.message}`);
      options.onConnectionUpdate(ConnectionState.ERROR);
    }
  }

  private startAudioStreaming() {
    if (!this.inputAudioContext || !this.stream) return;
    this.source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      this.sessionPromise?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
    };
    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  public stopStreaming() {
    if (this.source && this.processor) {
      try { this.source.disconnect(); this.processor.disconnect(); } catch(e) {}
    }
  }

  public resumeStreaming() {
    if (this.source && this.processor && this.inputAudioContext) {
      this.source.connect(this.processor);
      this.processor.connect(this.inputAudioContext.destination);
    }
  }

  public async disconnect() {
    this.stopStreaming();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();
    this.sessionPromise = null;
  }
}
