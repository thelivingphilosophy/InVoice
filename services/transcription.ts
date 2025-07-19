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

  async testRawUpload(audioUri: string): Promise<TranscriptionResult> {
    try {
      console.log('🧪 RAW UPLOAD TEST - bypassing all our logic');
      
      // Test 1: Most basic FormData approach
      console.log('📤 Test 1: Basic FormData with file URI');
      const formData1 = new FormData();
      formData1.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'test.m4a',
      } as any);
      formData1.append('model', 'whisper-1');
      
      const response1 = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        body: formData1,
      });
      
      console.log('📡 Basic test response:', response1.status);
      if (response1.ok) {
        const text = await response1.text();
        return { success: true, text };
      }
      
      // Test 2: Try with different MIME type
      console.log('📤 Test 2: Different MIME type');
      const formData2 = new FormData();
      formData2.append('file', {
        uri: audioUri,
        type: 'audio/mpeg',
        name: 'test.mp3',
      } as any);
      formData2.append('model', 'whisper-1');
      
      const response2 = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        body: formData2,
      });
      
      console.log('📡 MIME test response:', response2.status);
      if (response2.ok) {
        const text = await response2.text();
        return { success: true, text };
      }
      
      // Test 3: Try as generic audio
      console.log('📤 Test 3: Generic audio type');
      const formData3 = new FormData();
      formData3.append('file', {
        uri: audioUri,
        type: 'audio/*',
        name: 'test.audio',
      } as any);
      formData3.append('model', 'whisper-1');
      
      const response3 = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        body: formData3,
      });
      
      console.log('📡 Generic test response:', response3.status);
      if (response3.ok) {
        const text = await response3.text();
        return { success: true, text };
      }

      // Test 4: Try FileSystem.uploadAsync (works differently than FormData)
      console.log('📤 Test 4: FileSystem.uploadAsync approach');
      try {
        const uploadResponse = await FileSystem.uploadAsync(
          'https://api.openai.com/v1/audio/transcriptions',
          audioUri,
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
        
        console.log('📡 FileSystem upload response:', uploadResponse.status);
        if (uploadResponse.status === 200) {
          return { success: true, text: uploadResponse.body };
        }
        
        console.log('📤 Test 4 error:', uploadResponse.body);
      } catch (uploadError) {
        console.log('📤 Test 4 exception:', uploadError);
      }
      
      // All failed - get detailed error messages
      const errorText1 = await response1.text();
      const errorText2 = await response2.text();
      const errorText3 = await response3.text();
      
      console.log('📤 Test 1 error:', errorText1);
      console.log('📤 Test 2 error:', errorText2);
      console.log('📤 Test 3 error:', errorText3);
      
      return { 
        success: false, 
        error: `All tests failed.\nTest 1 (M4A): ${errorText1}\nTest 2 (MP3): ${errorText2}\nTest 3 (Generic): ${errorText3}` 
      };
      
    } catch (error) {
      return { success: false, error: `Raw test error: ${error}` };
    }
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
      
      // Debug the file first
      const debugInfo = await this.debugRecordedFile(audioUri);
      console.log('🔍 Debug result:', debugInfo);
      
      // First, let's debug what we're actually working with
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('📁 File info:', {
        exists: fileInfo.exists,
        size: fileInfo.size,
        uri: audioUri,
        isBlob: audioUri.startsWith('blob:'),
        isFile: audioUri.startsWith('file:')
      });

      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }

      if (fileInfo.size === 0) {
        throw new Error('Audio file is empty');
      }

      // Convert the audio URI to actual file data
      let audioBlob: Blob;
      
      if (audioUri.startsWith('blob:')) {
        // Handle blob URLs (web)
        console.log('🌐 Handling blob URL');
        const response = await fetch(audioUri);
        audioBlob = await response.blob();
        console.log('📦 Blob info:', { type: audioBlob.type, size: audioBlob.size });
      } else {
        // Handle file URIs (mobile) - use simple FormData approach
        console.log('📱 Handling file URI - using direct file approach');
        
        // Detect MIME type based on actual file content, not extension
        const base64Header = await FileSystem.readAsStringAsync(audioUri, {
          encoding: FileSystem.EncodingType.Base64,
          length: 50,
          position: 0,
        });
        
        const binaryData = atob(base64Header);
        const hexHeader = Array.from(binaryData)
          .map(byte => byte.charCodeAt(0).toString(16).padStart(2, '0'))
          .join(' ');
        
        let mimeType = 'audio/wav'; // Default
        let fileName = 'audio.wav';
        
        // Detect actual file format by header signature
        if (hexHeader.includes('66 74 79 70')) { // 'ftyp' - M4A/MP4
          mimeType = 'audio/m4a';
          fileName = 'audio.m4a';
          console.log('🔍 Detected M4A file (despite .wav extension)');
        } else if (hexHeader.startsWith('52 49 46 46') && hexHeader.includes('57 41 56 45')) { // RIFF + WAVE
          mimeType = 'audio/wav';
          fileName = 'audio.wav';
          console.log('🔍 Detected real WAV file');
        } else if (hexHeader.startsWith('ff fb') || hexHeader.startsWith('ff f3') || hexHeader.startsWith('ff f2')) { // MP3
          mimeType = 'audio/mpeg';
          fileName = 'audio.mp3';
          console.log('🔍 Detected MP3 file');
        }
        
        console.log('🎵 Using MIME type:', mimeType, 'filename:', fileName);
        
        // For React Native, we can use the URI directly in FormData
        const formData = new FormData();
        formData.append('file', {
          uri: audioUri,
          type: mimeType,
          name: fileName,
        } as any);
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'text');

        console.log('🚀 Sending to OpenAI API with direct URI...');
        
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: formData,
        });

        console.log('📡 API Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Transcription API error:', response.status, errorText);
          return {
            success: false,
            error: `API Error: ${response.status} - ${errorText}`,
          };
        }

        const transcriptionText = await response.text();
        console.log('✅ Transcription successful:', transcriptionText.substring(0, 100));

        return {
          success: true,
          text: transcriptionText.trim(),
        };
      }

      // For blob URLs (web), create FormData with blob
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'text');

      console.log('🚀 Sending blob to OpenAI API...');
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Transcription API error:', response.status, errorText);
        return {
          success: false,
          error: `API Error: ${response.status} - ${errorText}`,
        };
      }

      const transcriptionText = await response.text();
      console.log('✅ Transcription successful:', transcriptionText.substring(0, 100));

      return {
        success: true,
        text: transcriptionText.trim(),
      };
    } catch (error) {
      console.error('❌ Transcription error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown transcription error',
      };
    }
  }
}