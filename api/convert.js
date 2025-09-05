// api/convert.js
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export default async function handler(req, res) {
  // CORS headers för bergli.se
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('🎵 Konvertering startad');
    
    // Generera unika filnamn
    const inputId = randomUUID();
    const outputId = randomUUID();
    
    // Hämta fil-data från request
    const { fileData, fileName, outputFormat = 'mp3', quality = '128k' } = req.body;
    
    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'Fildata och filnamn krävs' });
    }
    
    // Dekoda base64 fil-data
    const buffer = Buffer.from(fileData, 'base64');
    
    // Temporära filer
    const tempDir = tmpdir();
    const inputPath = path.join(tempDir, `input_${inputId}${path.extname(fileName)}`);
    const outputPath = path.join(tempDir, `output_${outputId}.${outputFormat}`);
    
    console.log('📁 Sparar temporär fil:', inputPath);
    
    // Spara input-fil
    await writeFile(inputPath, buffer);
    
    // FFmpeg kommando beroende på format och kvalitet
    let ffmpegCmd;
    
    if (outputFormat === 'mp3') {
      // Specialhantering för 64kbps mono (din preferens)
      if (quality === '64k' || quality === 'mono64') {
        ffmpegCmd = `ffmpeg -i "${inputPath}" -b:a 64k -ac 1 -ar 22050 "${outputPath}"`;
      } else {
        ffmpegCmd = `ffmpeg -i "${inputPath}" -b:a ${quality} "${outputPath}"`;
      }
    } else if (outputFormat === 'wav') {
      ffmpegCmd = `ffmpeg -i "${inputPath}" -acodec pcm_s16le "${outputPath}"`;
    } else if (outputFormat === 'ogg') {
      ffmpegCmd = `ffmpeg -i "${inputPath}" -b:a ${quality} -acodec libvorbis "${outputPath}"`;
    } else {
      ffmpegCmd = `ffmpeg -i "${inputPath}" -b:a ${quality} "${outputPath}"`;
    }
    
    console.log('⚙️ Kör FFmpeg:', ffmpegCmd);
    
    // Kör FFmpeg
    const { stdout, stderr } = await execAsync(ffmpegCmd);
    
    console.log('✅ FFmpeg klar');
    
    // Läs konverterad fil
    const outputBuffer = await readFile(outputPath);
    const outputBase64 = outputBuffer.toString('base64');
    
    // Rensa temporära filer
    try {
      await unlink(inputPath);
      await unlink(outputPath);
      console.log('🗑️ Temporära filer rensade');
    } catch (cleanupError) {
      console.warn('⚠️ Kunde inte rensa alla temporära filer:', cleanupError.message);
    }
    
    // Skicka tillbaka konverterad fil
    return res.status(200).json({
      success: true,
      message: 'Konvertering lyckades!',
      outputData: outputBase64,
      originalName: fileName,
      outputFormat: outputFormat,
      fileSize: outputBuffer.length
    });
    
  } catch (error) {
    console.error('❌ Konverteringsfel:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Konvertering misslyckades',
      details: error.message
    });
  }
}

// package.json
{
  "name": "ljudkonverteraren-api",
  "version": "1.0.0",
  "description": "FFmpeg API för LjudKonverteraren",
  "main": "api/convert.js",
  "type": "module",
  "scripts": {
    "dev": "vercel dev",
    "build": "echo 'No build needed for serverless functions'"
  },
  "dependencies": {},
  "engines": {
    "node": "18.x"
  }
}

// vercel.json
{
  "functions": {
    "api/convert.js": {
      "maxDuration": 60
    }
  },
  "buildCommand": "",
  "outputDirectory": ""
}
