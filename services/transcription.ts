import * as FileSystem from 'expo-file-system';

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
}

export class TranscriptionService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async testMp3Access(): Promise<TranscriptionResult> {
    try {
      console.log('🎵 TESTING MP3 FILE ACCESS');
      const results: string[] = [];
      
      // Test 1: List all possible asset directories
      console.log('📁 Test 1: Exploring asset directories');
      const directoriesToCheck = [
        FileSystem.bundleDirectory,
        FileSystem.documentDirectory,
        FileSystem.cacheDirectory,
        `${FileSystem.bundleDirectory}assets/`,
        `${FileSystem.bundleDirectory}assets/audio/`,
      ];
      
      for (const dir of directoriesToCheck) {
        try {
          const dirInfo = await FileSystem.getInfoAsync(dir);
          console.log(`📂 Directory ${dir}: exists=${dirInfo.exists}`);
          
          if (dirInfo.exists && dirInfo.isDirectory) {
            const contents = await FileSystem.readDirectoryAsync(dir);
            console.log(`📂 Contents of ${dir}:`, contents);
            results.push(`✅ Directory ${dir}: ${contents.join(', ')}`);
          } else {
            results.push(`❌ Directory ${dir}: not found or not directory`);
          }
        } catch (error) {
          results.push(`❌ Directory ${dir}: error ${error}`);
        }
      }
      
      // Test 2: Use existing speech MP3 files we found
      console.log('🔍 Test 2: Using existing speech MP3 files');
      
      // Pick a few recent speech MP3 files from the documents directory
      const speechMp3Files = [
        `${FileSystem.documentDirectory}speech_1752844263396.mp3`,
        `${FileSystem.documentDirectory}speech_1752844260389.mp3`,
        `${FileSystem.documentDirectory}speech_1752844249604.mp3`,
      ];
      
      for (const speechPath of speechMp3Files) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(speechPath);
          console.log(`🎵 Speech MP3 at ${speechPath}: exists=${fileInfo.exists}, size=${fileInfo.size}`);
          
          if (fileInfo.exists && fileInfo.size > 0) {
            results.push(`✅ Found speech MP3: ${speechPath} (${fileInfo.size} bytes)`);
            
            // Try to upload this MP3 with FileSystem.uploadAsync
            console.log('🚀 Test 3: Uploading speech MP3');
            const uploadResponse = await FileSystem.uploadAsync(
              'https://api.openai.com/v1/audio/transcriptions',
              speechPath,
              {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: 'file',
                headers: {
                  'Authorization': `Bearer ${this.apiKey}`,
                },
                parameters: {
                  model: 'whisper-1',
                  response_format: 'text',
                },
              }
            );
            
            console.log('📡 Speech MP3 upload status:', uploadResponse.status);
            console.log('📡 Speech MP3 upload body:', uploadResponse.body);
            
            if (uploadResponse.status === 200) {
              results.push('🎉 SUCCESS! Speech MP3 transcription worked!');
              return { success: true, text: uploadResponse.body };
            } else {
              results.push(`❌ Speech MP3 upload failed: ${uploadResponse.status} - ${uploadResponse.body.substring(0, 100)}`);
            }
            
            // Only try the first working file
            break;
          } else {
            results.push(`❌ Speech MP3 empty or missing: ${speechPath}`);
          }
        } catch (error) {
          results.push(`❌ Error checking speech MP3 ${speechPath}: ${error}`);
        }
      }
      
      const finalReport = results.join('\n');
      console.log('🔬 MP3 ACCESS TEST RESULTS:\n', finalReport);
      
      return { 
        success: false, 
        error: `MP3 not found or upload failed:\n${finalReport}`
      };
      
    } catch (error) {
      return { success: false, error: `MP3 test error: ${error}` };
    }
  }

  async testTenHypotheses(audioUri: string): Promise<TranscriptionResult> {
    // Redirect to MP3 access test
    return this.testMp3Access();
  }

  async testRawUpload(audioUri: string): Promise<TranscriptionResult> {
    // Redirect to new systematic testing
    return this.testTenHypotheses(audioUri);
  }

  async debugRecordedFile(audioUri: string): Promise<string> {
    try {
      console.log('🔍 DEBUGGING RECORDED FILE:');
      
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('📁 File info:', {
        exists: fileInfo.exists,
        size: fileInfo.size,
        uri: audioUri,
        extension: audioUri.split('.').pop(),
      });

      // Read first 100 bytes as hex to examine file headers
      const base64Header = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
        length: 100,
        position: 0,
      });
      
      // Convert to hex for inspection
      const binaryData = atob(base64Header);
      const hexHeader = Array.from(binaryData)
        .map(byte => byte.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(' ');
      
      console.log('🔢 File header (first 50 bytes as hex):', hexHeader.substring(0, 150));
      
      // Check for common audio file signatures
      const signatures = {
        'RIFF WAV': hexHeader.startsWith('52 49 46 46') && hexHeader.includes('57 41 56 45'),
        'MP3': hexHeader.startsWith('ff fb') || hexHeader.startsWith('ff f3') || hexHeader.startsWith('ff f2'),
        'M4A': hexHeader.includes('66 74 79 70') // 'ftyp' marker
      };
      
      console.log('📋 File signature check:', signatures);
      
      return `File: ${fileInfo.size} bytes, Header: ${hexHeader.substring(0, 30)}...`;
      
    } catch (error) {
      console.error('❌ Debug error:', error);
      return `Debug failed: ${error}`;
    }
  }

  async transcribeAudio(audioUri: string): Promise<TranscriptionResult> {
    try {
      console.log('🎤 Starting transcription for audio:', audioUri);
      
      // First, let's debug what we're actually working with
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('📁 File info:', {
        exists: fileInfo.exists,
        size: fileInfo.size,
        uri: audioUri,
      });

      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }

      if (fileInfo.size === 0) {
        throw new Error('Audio file is empty');
      }

      console.log('🚀 Using FileSystem.uploadAsync with expo-audio files');
      
      // Determine MIME type based on file extension
      let mimeType = 'audio/wav'; // Default
      if (audioUri.includes('.mp3')) {
        mimeType = 'audio/mpeg';
        console.log('📱 Detected MP3 file from expo-audio');
      } else if (audioUri.includes('.wav')) {
        mimeType = 'audio/wav';
        console.log('📱 Detected WAV file from expo-audio');
      }
      
      // Upload the file with proper MIME type
      const uploadResponse = await FileSystem.uploadAsync(
        'https://api.openai.com/v1/audio/transcriptions',
        audioUri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: mimeType,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          parameters: {
            model: 'whisper-1',
            response_format: 'text',
          },
        }
      );
      
      console.log('📡 Upload response status:', uploadResponse.status);
      
      if (uploadResponse.status === 200) {
        console.log('✅ Transcription successful with expo-audio!');
        return {
          success: true,
          text: uploadResponse.body.trim(),
        };
      } else {
        console.error('❌ Upload failed:', uploadResponse.status, uploadResponse.body);
        return {
          success: false,
          error: `Upload failed: ${uploadResponse.status} - ${uploadResponse.body}`,
        };
      }
      
    } catch (error) {
      console.error('❌ Transcription error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown transcription error',
      };
    }
  }
}