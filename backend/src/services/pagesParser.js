import { execa } from 'execa';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * Extracts text from an Apple Pages (.pages) file.
 * @param {string} filepath - The path to the .pages file.
 * @returns {Promise<string>} - A promise that resolves with the extracted text.
 */
export async function extractTextFromPages(filepath) {
  try {
    // Use pandoc to convert the .pages file to plain text
    const { stdout } = await execa('pandoc', [filepath, '-f', 'pages', '-t', 'plain']);
    return stdout;
  } catch (error) {
    logger.error(`Error extracting content from ${filepath} using pandoc:`, error);
    // Provide a more specific error message if pandoc is not found
    if (error.code === 'ENOENT') {
      throw new Error('Pandoc is not installed or not in your system PATH. Please install it to process .pages files.');
    }
    throw new Error(`Failed to extract content from .pages file: ${error.message}`);
  }
}