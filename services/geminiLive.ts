import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { ConnectionState } from "../types";
import { decode, decodeAudioData, createPcmBlob } from "../utils/audioUtils";

interface LiveServiceOptions {
  onConnectionUpdate: (state: ConnectionState) => void;
  onAudioData: (audioBuffer: AudioBuffer) => void;
  onTranscript: (text: string, isUser: boolean) => void;
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
  
  constructor() {}

  public async connect(options: LiveServiceOptions, retryCount = 0) {
    try {
      options.onConnectionUpdate(ConnectionState.CONNECTING);

      if (!process.env.API_KEY) {
        throw new Error("API Key not found in environment.");
      }

      // Initialize fresh client right before connecting
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Setup Audio Contexts
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.outputAudioContext.destination);

      // Get Microphone
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Start Session
      this.sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are Overlord, a tactical dispatcher. Keep responses brief, military-style, and radio-like. Use Spanish if the user speaks Spanish.',
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            options.onConnectionUpdate(ConnectionState.CONNECTED);
            this.startAudioStreaming();
          },
          onmessage: async (message: LiveServerMessage) => {
            try {
              // Handle Audio Output
              const parts = message.serverContent?.modelTurn?.parts;
              const audioPart = parts?.find(p => p.inlineData?.data);
              const base64Audio = audioPart?.inlineData?.data;

              if (base64Audio && this.outputAudioContext && this.outputNode) {
                this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
                const audioBytes = decode(base64Audio);
                const audioBuffer = await decodeAudioData(audioBytes, this.outputAudioContext, 24000, 1);
                
                const source = this.outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(this.outputNode);
                source.addEventListener('ended', () => {
                  this.sources.delete(source);
                });
                
                source.start(this.nextStartTime);
                this.nextStartTime += audioBuffer.duration;
                this.sources.add(source);
                
                options.onAudioData(audioBuffer);
              }

              const interrupted = message.serverContent?.interrupted;
              if (interrupted) {
                for (const source of this.sources.values()) {
                  try { source.stop(); } catch(e) {}
                  this.sources.delete(source);
                }
                this.nextStartTime = 0;
              }

              // Handle Transcripts
              if (message.serverContent?.outputTranscription?.text) {
                options.onTranscript(message.serverContent.outputTranscription.text, false);
              }
              if (message.serverContent?.inputTranscription?.text) {
                options.onTranscript(message.serverContent.inputTranscription.text, true);
              }
            } catch (e) {
              console.error("Error processing message:", e);
            }
          },
          onclose: (e) => {
            console.debug('Session closed', e);
            options.onConnectionUpdate(ConnectionState.DISCONNECTED);
          },
          onerror: (err: any) => {
            console.error("Gemini Live Error:", err);
            
            // Handle service unavailable or 503 with a retry
            const isUnavailable = err.message?.toLowerCase().includes('unavailable') || 
                                err.message?.includes('503') || 
                                err.message?.includes('429');

            if (isUnavailable && retryCount < 3) {
              console.warn(`Service pressure detected, retrying (${retryCount + 1}/3)...`);
              this.disconnect().then(() => {
                setTimeout(() => this.connect(options, retryCount + 1), 1500 * (retryCount + 1));
              });
            } else {
              options.onConnectionUpdate(ConnectionState.ERROR);
            }
          }
        }
      });
      
      this.sessionPromise.catch((err) => {
        console.error("Session initialization promise rejected:", err);
        options.onConnectionUpdate(ConnectionState.ERROR);
      });
      
    } catch (error) {
      console.error("Connection attempt failed synchronously:", error);
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
      
      // Prevent "Uncaught (in promise)" by adding a second argument or catch
      this.sessionPromise?.then(
        (session) => {
          session.sendRealtimeInput({ media: pcmBlob });
        },
        (err) => {
          // Promise rejected (e.g. connection failed or was closed)
          // Error is already handled by sessionPromise.catch or onerror
        }
      );
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  public stopStreaming() {
     if (this.source && this.processor) {
         try { this.source.disconnect(this.processor); } catch(e) {}
         try { this.processor.disconnect(); } catch(e) {}
     }
  }
  
  public resumeStreaming() {
      if (this.source && this.processor && this.inputAudioContext) {
          this.source.connect(this.processor);
          this.processor.connect(this.inputAudioContext.destination);
      }
  }

  public async disconnect() {
    // Clean up Active Sources
    for (const source of this.sources.values()) {
      try { source.stop(); } catch(e) {}
      this.sources.delete(source);
    }
    this.nextStartTime = 0;

    // Clean up Audio context first to stop processing
    this.stopStreaming();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try { track.stop(); } catch(e) {}
      });
    }
    
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
      try { await this.inputAudioContext.close(); } catch(e) {}
    }
    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') {
      try { await this.outputAudioContext.close(); } catch(e) {}
    }
    
    // Finally close session
    if (this.sessionPromise) {
      try {
        const session = await this.sessionPromise;
        if (session && typeof session.close === 'function') {
          session.close();
        }
      } catch (e) {
        // Already closed or failed
      }
    }

    this.sessionPromise = null;
    this.inputAudioContext = null;
    this.outputAudioContext = null;
    this.processor = null;
    this.source = null;
    this.stream = null;
  }
}