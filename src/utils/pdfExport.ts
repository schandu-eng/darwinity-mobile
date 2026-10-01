import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import {
  buildNotesPdfHtml,
  notesToBlocks,
  sanitizePdfFilename,
} from '@shared/notesPdfDocument.js';
import type { Topic } from '@/api/schemas/content';
import { saveToDownloadsAndroid, type DownloadSaveLocation } from '@/utils/androidDownloads';
import { API_BASE_URL } from '@/utils/constants';
import { getAuthToken } from '@/api/client';

interface PDFExportOptions {
  title: string;
  summary: unknown;
}

function summaryToExportInputs(summary: unknown): { topics: Topic[]; editorBlocks: unknown } {
  if (!summary || typeof summary !== 'object') {
    return { topics: [], editorBlocks: null };
  }

  const record = summary as Record<string, unknown>;
  const editorBlocks = record.editor_blocks ?? null;
  const detailedNotes = Array.isArray(record.detailed_notes) ? record.detailed_notes : [];
  const topics = detailedNotes.map((note) => {
    const item = note as { topic?: string; content?: string };
    return {
      title: item.topic || 'Untitled',
      note: item.content || '',
    };
  });

  return { topics, editorBlocks };
}

export function hasExportableSummaryNotes(summary: unknown): boolean {
  const { topics, editorBlocks } = summaryToExportInputs(summary);
  return notesToBlocks({ topics, editorBlocks }).length > 0;
}

const normalizeFileUri = (fileUri: string): string => {
  if (fileUri.startsWith('file://') || fileUri.startsWith('content://')) {
    return fileUri;
  }
  return `file://${fileUri}`;
};

const getDownloadFilename = (title: string): string => {
  const sanitizedTitle = sanitizePdfFilename(title) || 'Notes';
  return `${sanitizedTitle}.pdf`;
};

export interface SavePDFResult {
  uri: string;
  location: DownloadSaveLocation;
}

export const generatePDFFromSummary = async (
  options: PDFExportOptions
): Promise<string> => {
  let tempUri: string | null = null;

  try {
    const { title, summary } = options;
    const { topics, editorBlocks } = summaryToExportInputs(summary);
    const blocks = notesToBlocks({ topics, editorBlocks });

    if (blocks.length === 0) {
      throw new Error('No content available to export');
    }

    const html = buildNotesPdfHtml({
      title,
      blocks,
      includeClientPrintChrome: false,
    });

    const endpoint = `${API_BASE_URL}/api/v1/materials/export-notes-pdf`;
    let token: string | null = null;
    try {
      token = await getAuthToken();
    } catch (authError) {
      throw new Error('Please sign in again to export PDFs.');
    }
    if (!token) {
      throw new Error('Please sign in to export PDFs.');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        html,
        title,
        base_url: API_BASE_URL,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Your session has expired. Please sign in again to export PDFs.');
      }
      let detail = `Failed to export PDF (HTTP ${response.status})`;
      try {
        const json = await response.json();
        detail = json?.detail || json?.message || detail;
      } catch {}
      throw new Error(detail);
    }

    const base64Pdf = arrayBufferToBase64(await response.arrayBuffer());
    const sanitizedTitle = sanitizePdfFilename(title) || 'Notes';
    tempUri = `${FileSystem.cacheDirectory}${sanitizedTitle}.pdf`;

    const existingFile = await FileSystem.getInfoAsync(tempUri);
    if (existingFile.exists) {
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
    }

    await FileSystem.writeAsStringAsync(tempUri, base64Pdf, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return tempUri;
  } catch (error) {
    if (tempUri) {
      try {
        await FileSystem.deleteAsync(tempUri, { idempotent: true });
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp PDF file:', cleanupError);
      }
    }
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const arrayBufferToBase64 = (arrayBuffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(arrayBuffer);
  const globalBuffer = (globalThis as { Buffer?: { from: (input: Uint8Array) => { toString: (enc: string) => string } } })
    .Buffer;
  if (globalBuffer?.from) {
    return globalBuffer.from(bytes).toString('base64');
  }

  const base64Encoder = (globalThis as { btoa?: (data: string) => string }).btoa;
  if (typeof base64Encoder === 'function') {
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return base64Encoder(binary);
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;

    const triple = (a << 16) | (b << 8) | c;

    base64 += chars[(triple >> 18) & 0x3f];
    base64 += chars[(triple >> 12) & 0x3f];
    base64 += i + 1 < bytes.length ? chars[(triple >> 6) & 0x3f] : '=';
    base64 += i + 2 < bytes.length ? chars[triple & 0x3f] : '=';
  }

  return base64;
};

export const savePDFFile = async (fileUri: string, title: string): Promise<SavePDFResult> => {
  if (!fileUri) {
    throw new Error('PDF file not available for saving');
  }

  const normalizedUri = normalizeFileUri(fileUri);

  if (Platform.OS === 'android') {
    const result = await saveToDownloadsAndroid({
      fileUri: normalizedUri,
      fileName: getDownloadFilename(title),
      mimeType: 'application/pdf',
    });
    return { uri: result.uri, location: result.location };
  }

  const directory = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  if (!directory) {
    throw new Error('Storage directory not available');
  }

  const filename = getDownloadFilename(title);
  const destinationUri = `${directory}${filename}`;
  const existingFile = await FileSystem.getInfoAsync(destinationUri);
  if (existingFile.exists) {
    await FileSystem.deleteAsync(destinationUri, { idempotent: true });
  }

  await FileSystem.copyAsync({
    from: normalizedUri,
    to: destinationUri,
  });

  return { uri: destinationUri, location: 'app' };
};

export const sharePDFFile = async (
  fileUri: string,
  title: string,
  onShareComplete?: () => void
): Promise<boolean> => {
  try {
    if (!fileUri) {
      throw new Error('PDF file not available for sharing');
    }

    const safeTitle = title?.trim() || 'Notes';
    const normalizedUri = normalizeFileUri(fileUri);
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(normalizedUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Share ${safeTitle}.pdf`,
      UTI: 'com.adobe.pdf',
    });

    if (onShareComplete) {
      onShareComplete();
    }

    return true;
  } catch (error) {
    if (onShareComplete) {
      onShareComplete();
    }

    if (error instanceof Error && error.message !== 'User did not share') {
      throw new Error(`Failed to share PDF: ${error.message}`);
    }
    return false;
  }
};

export const cleanupPDFFile = async (fileUri: string): Promise<void> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  } catch (error) {
    console.warn('Failed to cleanup PDF file:', error);
  }
};
