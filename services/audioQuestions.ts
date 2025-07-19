import { Audio } from 'expo-av';

export type VoiceTone = 'friendly' | 'professional' | 'casual' | 'default';

class GlobalAudioManager {
  private static instance: GlobalAudioManager;
  private currentSound: Audio.Sound | null = null;

  static getInstance(): GlobalAudioManager {
    if (!GlobalAudioManager.instance) {
      GlobalAudioManager.instance = new GlobalAudioManager();
    }
    return GlobalAudioManager.instance;
  }

  async stopCurrentSound(): Promise<void> {
    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync();
        await this.currentSound.unloadAsync();
        this.currentSound = null;
        console.log('🎵 Audio stopped and unloaded');
      } catch (error) {
        console.log('Audio stop error (likely already stopped):', error);
        this.currentSound = null;
      }
    }
  }

  async forceStop(): Promise<void> {
    if (this.currentSound) {
      try {
        // More aggressive stopping for interrupts
        await this.currentSound.stopAsync();
        await this.currentSound.unloadAsync();
        this.currentSound = null;
        console.log('🛑 Audio force stopped');
      } catch (error) {
        console.log('Force stop error (likely already stopped):', error);
        this.currentSound = null;
      }
    }
  }

  setCurrentSound(sound: Audio.Sound): void {
    this.currentSound = sound;
  }

  getCurrentSound(): Audio.Sound | null {
    return this.currentSound;
  }
}

export class AudioQuestionService {
  private globalAudioManager: GlobalAudioManager;

  constructor() {
    this.globalAudioManager = GlobalAudioManager.getInstance();
  }

  async playQuestion(questionNumber: number, tone: VoiceTone): Promise<void> {
    // Stop any currently playing audio first
    await this.stopAudio();

    try {
      console.log(`🎵 Playing question ${questionNumber} with tone: ${tone}`);
      
      // Construct audio file path based on tone and question number
      const audioPath = this.getAudioPath(questionNumber, tone);
      
      const { sound } = await Audio.Sound.createAsync(
        audioPath,
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            console.log(`🎵 Question ${questionNumber} finished playing`);
            this.globalAudioManager.setCurrentSound(null);
          }
        }
      );

      this.globalAudioManager.setCurrentSound(sound);
      console.log(`🎵 Started playing question ${questionNumber}`);
    } catch (error) {
      console.error(`❌ Failed to play question ${questionNumber}:`, error);
      throw error;
    }
  }

  async stopAudio(): Promise<void> {
    await this.globalAudioManager.stopCurrentSound();
  }

  async forceStop(): Promise<void> {
    await this.globalAudioManager.forceStop();
  }

  private getAudioPath(questionNumber: number, tone: VoiceTone) {
    // Static mapping of all available audio files
    const audioFiles: { [key: string]: any } = {
      // Casual files
      'casual-1': require('../assets/audio/Casual/casual-question-1.mp3'),
      'casual-2': require('../assets/audio/Casual/casual-question-2.mp3'),
      'casual-3': require('../assets/audio/Casual/casual-question-3.mp3'),
      'casual-4': require('../assets/audio/Casual/casual-question-4.mp3'),
      'casual-5': require('../assets/audio/Casual/casual-question-5.mp3'),
      
      // Direct files
      'direct-1': require('../assets/audio/Direct/direct-question-1.mp3'),
      'direct-2': require('../assets/audio/Direct/direct-question-2.mp3'),
      'direct-3': require('../assets/audio/Direct/direct-question-3.mp3'),
      'direct-4': require('../assets/audio/Direct/direct-question-4.mp3'),
      'direct-5': require('../assets/audio/Direct/direct-question-5-a.mp3'),
      
      // Whacky files (using -a variants where available)
      'whacky-1': require('../assets/audio/Whacky/whacky-question-1-a.mp3'),
      'whacky-2': require('../assets/audio/Whacky/whacky-question-2.mp3'),
      'whacky-3': require('../assets/audio/Whacky/whacky-question-3.mp3'),
      'whacky-4': require('../assets/audio/Whacky/whacky-question-4.mp3'),
      'whacky-5': require('../assets/audio/Whacky/whacky-question-5-a.mp3'),
    };

    // If default tone, use TTS
    if (tone === 'default') {
      throw new Error(`Audio files not available for tone: ${tone} - using TTS fallback`);
    }

    const audioKey = `${tone}-${questionNumber}`;
    const audioPath = audioFiles[audioKey];
    
    if (audioPath) {
      console.log(`🎵 Found audio file for: ${audioKey}`);
      return audioPath;
    } else {
      console.log(`Audio file not found for key: ${audioKey}, using TTS fallback`);
      throw new Error(`Audio file not found for tone: ${tone}, question: ${questionNumber}`);
    }
  }
}