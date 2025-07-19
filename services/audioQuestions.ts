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
    // Since we lost the audio files, always throw error to fall back to TTS
    // When you re-record audio files, you can uncomment the code below
    
    /*
    // Map tone to folder name
    const toneFolder = {
      'friendly': 'friendly',
      'professional': 'professional', 
      'casual': 'casual',
      'default': 'default'
    }[tone] || 'default';

    try {
      return require(`../assets/audio/${toneFolder}/question${questionNumber}.m4a`);
    } catch (error) {
      console.log(`Audio file not found for ${toneFolder}/question${questionNumber}.m4a, using fallback`);
      throw new Error(`Audio file not found for tone: ${tone}, question: ${questionNumber}`);
    }
    */
    
    // For now, always fall back to TTS
    throw new Error(`Audio files not available - using TTS fallback`);
  }
}