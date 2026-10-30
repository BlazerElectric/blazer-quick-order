/**
 * Compresses and normalizes an image file (JPEG, PNG, HEIC, WebP, etc.)
 * using HTML5 Canvas to a maximum resolution (1600px) and quality (0.85 JPEG).
 * This ensures:
 * 1. Fast upload speeds (reduces 15MB phone photos to ~300KB)
 * 2. Uniform image/jpeg MIME type accepted by Gemini multimodal vision
 * 3. Prevention of 413 Payload Too Large and network timeouts
 */
export async function compressAndNormalizeImage(
  file: File,
  maxDimension = 1280,
  quality = 0.8
): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read the image file.'));
    };

    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) {
        reject(new Error('Image data is empty.'));
        return;
      }

      const img = new Image();
      img.onerror = () => {
        // If canvas loading fails (e.g. raw HEIC without browser support), fallback to original base64
        const match = rawDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          resolve({
            mimeType: match[1] || 'image/jpeg',
            base64: match[2],
            dataUrl: rawDataUrl,
          });
        } else {
          reject(new Error('Could not process this image format.'));
        }
      };

      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to original
          const match = rawDataUrl.match(/^data:([^;]+);base64,(.+)$/);
          resolve({
            mimeType: match?.[1] || 'image/jpeg',
            base64: match?.[2] || '',
            dataUrl: rawDataUrl,
          });
          return;
        }

        // Draw with white background to handle transparency
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        const match = compressedDataUrl.match(/^data:([^;]+);base64,(.+)$/);

        resolve({
          mimeType: 'image/jpeg',
          base64: match ? match[2] : '',
          dataUrl: compressedDataUrl,
        });
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Creates a realistic sample contractor handwritten material note on drywall/wood
 * for immediate 1-click testing of the multimodal vision model.
 */
export function createSampleJobsiteNote(): { base64: string; mimeType: string; dataUrl: string } {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 650;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // Draw textured drywall / sheetrock surface
  ctx.fillStyle = '#e5dfd4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add subtle drywall paper texture and scuffs
  ctx.fillStyle = '#dcd5c7';
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = Math.random() * 2 + 0.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Add light pencil guide lines
  ctx.strokeStyle = '#d0c8b6';
  ctx.lineWidth = 1;
  for (let y = 140; y < 600; y += 75) {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(860, y);
    ctx.stroke();
  }

  // Draw carpenter pencil / contractor marker writing
  ctx.fillStyle = '#222222';
  ctx.font = 'bold 30px "Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive, sans-serif';

  ctx.fillText('BLAZER WILL-CALL / SUITE 200 TRIM', 60, 95);

  ctx.font = '28px "Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive, sans-serif';
  ctx.fillStyle = '#2d3748';

  const lines = [
    '• 50ft 10/2 MC cable aluminum',
    '• 12 Caddy CJ6 cable supports',
    '• 10 3/4in EMT compression connectors',
    '• 4 4-square 1900 boxes w/ 1/2 mud ring',
    '• 100 yellow wire nuts',
  ];

  lines.forEach((line, index) => {
    ctx.fillText(line, 65, 175 + index * 75);
  });

  // Contractor signature & date in red carpenter pencil
  ctx.fillStyle = '#9b2c2c';
  ctx.font = 'italic 24px "Comic Sans MS", "Chalkboard SE", cursive, sans-serif';
  ctx.fillText('Job: Commercial Tenant Finish (Pueblo Branch)', 65, 575);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  return {
    mimeType: 'image/jpeg',
    base64: match ? match[2] : '',
    dataUrl,
  };
}
