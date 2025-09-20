import fileType from 'file-type';

export async function validateImageFile(buffer: Buffer): Promise<{
  valid: boolean;
  mimeType?: string;
  error?: string;
}> {
  try {
    // Check actual file type (not just extension)
    const type = await fileType.fromBuffer(buffer);
    
    if (!type) {
      return { valid: false, error: 'Unable to determine file type' };
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!allowedTypes.includes(type.mime)) {
      return { 
        valid: false, 
        error: `Invalid file type: ${type.mime}. Allowed: ${allowedTypes.join(', ')}` 
      };
    }
    
    // Check for malicious content patterns
    const bufferString = buffer.toString('hex', 0, 512);
    const suspiciousPatterns = [
      '3c73637269707420', // <script
      '6f6e6572726f72',   // onerror
      '6f6e6c6f6164'      // onload
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (bufferString.includes(pattern)) {
        return { valid: false, error: 'Suspicious content detected' };
      }
    }
    
    return { valid: true, mimeType: type.mime };
    
  } catch (error) {
    return { valid: false, error: 'File validation failed' };
  }
}