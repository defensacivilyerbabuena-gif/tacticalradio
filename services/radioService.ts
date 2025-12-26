
import { RealtimeChannel } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabase } from './supabase';
import { decode, decodeAudioData, createPcmBlob } from '../utils/audioUtils';

interface RadioOptions {
  userId: string;
  userName: string;
  onAudioBuffer: (buffer: AudioBuffer, senderId: string) => void;
  onIncomingStreamStart: (senderName: string) => void;
  onIncomingStreamEnd: () => void;
}

export class RadioService {
  private channel: RealtimeChannel;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private nextStartTime: number = 0;
  private options: RadioOptions;
  private isTransmitting: boolean = false;
  private sampleRate: number = 24000;
  
  // Umbral de ruido más agresivo para PC
  private noiseThreshold: number = 0.045; 
  private holdTime: number = 300; 
  private lastActiveTime: number = 0;

  constructor(options: RadioOptions) {
    this.options = options;
    this.channel = supabase.channel('tactical-freq-1', {
      config: { broadcast: { ack: false, self: false } }
    });
    
    this.channel
      .on('broadcast', { event: 'audio-packet' }, (payload) => {
        if (payload.payload.senderId !== this.options.userId) {
          this.handleIncomingAudio(payload.payload);
        }
      })
      .subscribe();
      
    this.initMicrophone();
  }

  private async initAudioContexts() {
    if (!this.inputAudioContext) {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: this.sampleRate });
    }
    if (!this.outputAudioContext) {
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: this.sampleRate });
    }
    if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();
    if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();
  }

  private async initMicrophone() {
    try {
      await this.initAudioContexts();
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        } 
      });
      
      this.source = this.inputAudioContext!.createMediaStreamSource(this.stream);
      this.processor = this.inputAudioContext!.createScriptProcessor(2048, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.isTransmitting) return;

        const inputData = e.inputBuffer.getChannelData(0);
        let maxVal = 0;
        for (let i = 0; i < inputData.length; i++) {
          const abs = Math.abs(inputData[i]);
          if (abs > maxVal) maxVal = abs;
        }

        const now = Date.now();
        if (maxVal >= this.noiseThreshold) {
          this.lastActiveTime = now;
        }

        if (maxVal < this.noiseThreshold && (now - this.lastActiveTime) > this.holdTime) {
          return;
        }

        const pcm = createPcmBlob(inputData);
        this.channel.send({
          type: 'broadcast',
          event: 'audio-packet',
          payload: {
            senderId: this.options.userId,
            senderName: this.options.userName,
            data: pcm.data
          }
        });
      };

      this.source.connect(this.processor);
      this.processor.connect(this.inputAudioContext!.destination);
    } catch (err) {
      console.error("MIC_INIT_ERROR:", err);
    }
  }

  private async handleIncomingAudio(payload: { data: string; senderName: string }) {
    await this.initAudioContexts();
    if (!this.outputAudioContext) return;

    this.options.onIncomingStreamStart(payload.senderName);
    
    try {
      const audioBytes = decode(payload.data);
      const buffer = await decodeAudioData(audioBytes, this.outputAudioContext, this.sampleRate, 1);
      
      const source = this.outputAudioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputAudioContext.destination);
      
      const currentTime = this.outputAudioContext.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.05; 
      }
      
      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;
      this.options.onAudioBuffer(buffer, payload.senderName);

      source.onended = () => {
        if (this.outputAudioContext && this.outputAudioContext.currentTime >= this.nextStartTime - 0.1) {
          this.options.onIncomingStreamEnd();
        }
      };
    } catch (e) {
      console.error("RX_ERROR:", e);
    }
  }

  public startTransmission() {
    this.isTransmitting = true;
    this.lastActiveTime = Date.now();
  }

  public stopTransmission() {
    this.isTransmitting = false;
  }

  public async disconnect() {
    this.isTransmitting = false;
    if (this.source) this.source.disconnect();
    if (this.processor) this.processor.disconnect();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();
  }
}
