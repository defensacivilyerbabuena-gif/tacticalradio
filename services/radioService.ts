
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

  constructor(options: RadioOptions) {
    this.options = options;
    this.channel = supabase.channel('tactical-freq-1');
    
    this.channel
      .on('broadcast', { event: 'audio-packet' }, (payload) => {
        if (payload.payload.senderId !== this.options.userId) {
          this.handleIncomingAudio(payload.payload);
        }
      })
      .subscribe();
  }

  private async initAudio() {
    if (!this.inputAudioContext) {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (!this.outputAudioContext) {
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();
    if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();
  }

  private async handleIncomingAudio(payload: { data: string; senderName: string }) {
    await this.initAudio();
    if (!this.outputAudioContext) return;

    this.options.onIncomingStreamStart(payload.senderName);
    
    const audioBytes = decode(payload.data);
    const buffer = await decodeAudioData(audioBytes, this.outputAudioContext, 16000, 1);
    
    const source = this.outputAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputAudioContext.destination);
    
    this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
    
    this.options.onAudioBuffer(buffer, payload.senderName);

    source.onended = () => {
      if (this.outputAudioContext && this.outputAudioContext.currentTime >= this.nextStartTime - 0.1) {
        this.options.onIncomingStreamEnd();
      }
    };
  }

  public async startTransmission() {
    await this.initAudio();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.inputAudioContext!.createMediaStreamSource(this.stream);
    this.processor = this.inputAudioContext!.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
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
  }

  public stopTransmission() {
    if (this.source) this.source.disconnect();
    if (this.processor) this.processor.disconnect();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
  }
}
