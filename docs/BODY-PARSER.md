# Body Parser & File Uploads

NextRush includes a comprehensive body parser that automatically handles JSON, form data, multipart uploads, and file processing with built-in security features.

## Automatic Body Parsing

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Body parsing is automatic - no configuration needed
app.post('/api/data', (req, res) => {
  // JSON body (Content-Type: application/json)
  console.log('JSON data:', req.body);

  // Form data (Content-Type: application/x-www-form-urlencoded)
  console.log('Form data:', req.body);

  // Raw body text
  console.log('Raw body:', req.rawBody);

  res.json({ received: req.body });
});
```

## JSON Request Handling

```typescript
// JSON API endpoint
app.post('/api/users', (req, res) => {
  // Automatically parsed JSON
  const { name, email, age } = req.body;

  // Built-in validation
  const validation = req.validate({
    name: { required: true, minLength: 2, maxLength: 50 },
    email: { required: true, type: 'email' },
    age: { type: 'number', min: 13, max: 120 },
  });

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      errors: validation.errors,
    });
  }

  // Use sanitized data
  const userData = validation.sanitized;
  res.status(201).json({ success: true, user: userData });
});
```

## Form Data Processing

```typescript
// HTML form handling
app.post('/contact', (req, res) => {
  // Form fields automatically available in req.body
  const { name, email, subject, message } = req.body;

  // Sanitize form input
  const cleanData = {
    name: req.sanitize(name, {
      trim: true,
      removeHtml: true,
      maxLength: 100,
    }),
    email: req.sanitize(email, {
      trim: true,
      lowercase: true,
    }),
    subject: req.sanitize(subject, {
      trim: true,
      removeHtml: true,
      maxLength: 200,
    }),
    message: req.sanitize(message, {
      trim: true,
      removeHtml: true,
      maxLength: 2000,
    }),
  };

  // Validate email
  if (!req.isValidEmail(cleanData.email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Process contact form...
  res.json({ success: true, message: 'Message sent!' });
});
```

## File Upload Handling

### Single File Upload

```typescript
// Single file upload
app.post('/api/upload/avatar', (req, res) => {
  const file = req.file('avatar');

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // File validation
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      error: 'Invalid file type. Only JPEG, PNG, and GIF allowed.',
    });
  }

  if (file.size > maxSize) {
    return res.status(400).json({
      error: 'File too large. Maximum size is 5MB.',
    });
  }

  // Generate safe filename
  const safeFilename = req
    .sanitize(file.filename, {
      removeHtml: true,
      trim: true,
      maxLength: 100,
    })
    .replace(/[^a-zA-Z0-9.-]/g, '_');

  const uniqueFilename = `${Date.now()}-${safeFilename}`;

  res.json({
    success: true,
    file: {
      original: file.filename,
      saved: uniqueFilename,
      size: file.size,
      mimetype: file.mimetype,
      path: `/uploads/${uniqueFilename}`,
    },
  });
});
```

### Multiple File Upload

```typescript
// Multiple file upload
app.post('/api/upload/documents', (req, res) => {
  const files = req.files('documents');

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const maxFiles = 10;
  if (files.length > maxFiles) {
    return res.status(400).json({
      error: `Too many files. Maximum ${maxFiles} files allowed.`,
    });
  }

  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];

  const maxSizePerFile = 10 * 1024 * 1024; // 10MB per file
  const uploadedFiles = [];
  const errors = [];

  files.forEach((file, index) => {
    // Validate each file
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`File ${index + 1}: Invalid file type`);
      return;
    }

    if (file.size > maxSizePerFile) {
      errors.push(`File ${index + 1}: File too large (max 10MB)`);
      return;
    }

    // Process valid file
    const safeFilename = req
      .sanitize(file.filename, {
        removeHtml: true,
        trim: true,
        maxLength: 100,
      })
      .replace(/[^a-zA-Z0-9.-]/g, '_');

    const uniqueFilename = `${Date.now()}-${index}-${safeFilename}`;

    uploadedFiles.push({
      original: file.filename,
      saved: uniqueFilename,
      size: file.size,
      mimetype: file.mimetype,
    });
  });

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      uploadedFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
    });
  }

  res.json({
    success: true,
    files: uploadedFiles,
    count: uploadedFiles.length,
  });
});
```

### Mixed Form Data with Files

```typescript
// Form with both text fields and files
app.post('/api/posts', (req, res) => {
  // Text fields
  const { title, content, category, tags } = req.body;

  // Files
  const featuredImage = req.file('featured_image');
  const attachments = req.files('attachments');

  // Validate text fields
  const validation = req.validate({
    title: { required: true, minLength: 5, maxLength: 200 },
    content: { required: true, minLength: 50 },
    category: { required: true },
    tags: { type: 'array', maxLength: 10 },
  });

  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }

  const postData = {
    ...validation.sanitized,
    tags: Array.isArray(tags) ? tags : [tags],
  };

  // Process featured image
  if (featuredImage) {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!imageTypes.includes(featuredImage.mimetype)) {
      return res.status(400).json({
        error: 'Featured image must be JPEG, PNG, or GIF',
      });
    }

    postData.featuredImage = {
      filename: featuredImage.filename,
      size: featuredImage.size,
      mimetype: featuredImage.mimetype,
    };
  }

  // Process attachments
  if (attachments && attachments.length > 0) {
    postData.attachments = attachments.map((file) => ({
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
    }));
  }

  res.json({
    success: true,
    post: postData,
  });
});
```

## Advanced File Processing

### Image Processing

```typescript
// Image upload with processing
app.post('/api/upload/photo', async (req, res) => {
  const photo = req.file('photo');

  if (!photo) {
    return res.status(400).json({ error: 'No photo uploaded' });
  }

  // Validate image
  const imageTypes = ['image/jpeg', 'image/png'];
  if (!imageTypes.includes(photo.mimetype)) {
    return res.status(400).json({
      error: 'Only JPEG and PNG images allowed',
    });
  }

  try {
    // Get image dimensions and metadata
    const imageInfo = await getImageInfo(photo.buffer);

    // Validate dimensions
    if (imageInfo.width > 4000 || imageInfo.height > 4000) {
      return res.status(400).json({
        error: 'Image too large. Maximum 4000x4000 pixels.',
      });
    }

    // Create different sizes
    const sizes = {
      thumbnail: { width: 150, height: 150 },
      medium: { width: 500, height: 500 },
      large: { width: 1200, height: 1200 },
    };

    const processedImages = {};

    for (const [sizeName, dimensions] of Object.entries(sizes)) {
      const resized = await resizeImage(photo.buffer, dimensions);
      const filename = `${Date.now()}-${sizeName}.jpg`;

      // Save to storage (implement your storage logic)
      await saveFile(filename, resized);

      processedImages[sizeName] = {
        filename,
        width: dimensions.width,
        height: dimensions.height,
        url: `/uploads/${filename}`,
      };
    }

    res.json({
      success: true,
      original: {
        filename: photo.filename,
        size: photo.size,
        width: imageInfo.width,
        height: imageInfo.height,
      },
      processed: processedImages,
    });
  } catch (error) {
    res.status(500).json({ error: 'Image processing failed' });
  }
});
```

### File Type Detection

```typescript
// Advanced file type validation
app.post('/api/upload/secure', (req, res) => {
  const file = req.file('document');

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Check file signature (magic numbers) not just extension
  const fileSignature = getFileSignature(file.buffer);
  const trueMimeType = getMimeTypeFromSignature(fileSignature);

  // Verify MIME type matches file signature
  if (file.mimetype !== trueMimeType) {
    return res.status(400).json({
      error: 'File type mismatch. File may be corrupted or malicious.',
    });
  }

  // Scan for malicious content
  const scanResult = scanFileForMalware(file.buffer);
  if (!scanResult.safe) {
    return res.status(400).json({
      error: 'File contains potentially malicious content',
    });
  }

  res.json({
    success: true,
    file: {
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      verified: true,
    },
  });
});

// File signature detection
function getFileSignature(buffer) {
  const signatures = {
    PDF: [0x25, 0x50, 0x44, 0x46], // %PDF
    JPEG: [0xff, 0xd8, 0xff],
    PNG: [0x89, 0x50, 0x4e, 0x47],
    ZIP: [0x50, 0x4b, 0x03, 0x04],
    DOC: [0xd0, 0xcf, 0x11, 0xe0],
  };

  for (const [type, signature] of Object.entries(signatures)) {
    if (buffer.subarray(0, signature.length).equals(Buffer.from(signature))) {
      return type;
    }
  }

  return 'UNKNOWN';
}
```

## Security Features

### File Upload Security

```typescript
// Secure file upload configuration
const secureUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5, // Max 5 files
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
  ],
  quarantineUntrusted: true, // Quarantine suspicious files
  scanForViruses: true, // Virus scanning
  stripMetadata: true, // Remove EXIF data from images
};

app.post('/api/secure-upload', (req, res) => {
  const files = req.files() || [];

  // Apply security checks
  const securityCheck = validateUploadSecurity(files, secureUploadConfig);

  if (!securityCheck.passed) {
    return res.status(400).json({
      error: 'Security validation failed',
      details: securityCheck.errors,
    });
  }

  // Process secure files
  const processedFiles = files.map((file) => ({
    filename: sanitizeFilename(file.filename),
    size: file.size,
    mimetype: file.mimetype,
    securityScore: securityCheck.scores[file.filename],
  }));

  res.json({
    success: true,
    files: processedFiles,
  });
});

function validateUploadSecurity(files, config) {
  const errors = [];
  const scores = {};

  // Check file count
  if (files.length > config.maxFiles) {
    errors.push(`Too many files. Maximum ${config.maxFiles} allowed.`);
  }

  files.forEach((file) => {
    let score = 100;

    // Check file size
    if (file.size > config.maxFileSize) {
      errors.push(`File ${file.filename} is too large`);
      score -= 30;
    }

    // Check MIME type
    if (!config.allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} not allowed`);
      score -= 50;
    }

    // Check filename for suspicious patterns
    if (/\.(exe|bat|cmd|scr|com|pif|vbs|js)$/i.test(file.filename)) {
      errors.push(`Suspicious file extension: ${file.filename}`);
      score -= 80;
    }

    // Check for null bytes (directory traversal attempt)
    if (file.filename.includes('\0')) {
      errors.push(`Invalid filename: ${file.filename}`);
      score -= 90;
    }

    scores[file.filename] = Math.max(0, score);
  });

  return {
    passed: errors.length === 0,
    errors,
    scores,
  };
}
```

### Input Sanitization

```typescript
// Comprehensive input sanitization
app.post('/api/sanitized-data', (req, res) => {
  // Different sanitization for different field types
  const sanitizedData = {
    // Name: remove HTML, trim, limit length
    name: req.sanitize(req.body.name, {
      removeHtml: true,
      trim: true,
      maxLength: 100,
      pattern: /^[a-zA-Z\s'-]+$/,
    }),

    // Email: lowercase, trim, validate
    email: req.sanitize(req.body.email, {
      trim: true,
      lowercase: true,
      removeHtml: true,
    }),

    // Bio: allow some HTML, limit length
    bio: req.sanitize(req.body.bio, {
      allowedTags: ['p', 'br', 'strong', 'em', 'a'],
      allowedAttributes: { a: ['href'] },
      maxLength: 500,
      removeScripts: true,
    }),

    // URL: validate and normalize
    website: req.body.website
      ? req.sanitize(req.body.website, {
          isUrl: true,
          protocols: ['http', 'https'],
        })
      : null,

    // Phone: remove non-digits, format
    phone: req.sanitize(req.body.phone, {
      removeNonDigits: true,
      minLength: 10,
      maxLength: 15,
    }),

    // Tags: array of strings, sanitized individually
    tags: (req.body.tags || []).map((tag) =>
      req.sanitize(tag, {
        trim: true,
        removeHtml: true,
        maxLength: 50,
        lowercase: true,
      })
    ),
  };

  // Additional validation
  if (!req.isValidEmail(sanitizedData.email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (sanitizedData.website && !req.isValidUrl(sanitizedData.website)) {
    return res.status(400).json({ error: 'Invalid website URL' });
  }

  res.json({
    success: true,
    data: sanitizedData,
  });
});
```

## Performance Optimization

### Streaming File Uploads

```typescript
// Handle large file uploads with streaming
app.post('/api/upload/large', (req, res) => {
  const maxSize = 100 * 1024 * 1024; // 100MB
  let uploadedSize = 0;

  req.on('data', (chunk) => {
    uploadedSize += chunk.length;

    // Check size limit during upload
    if (uploadedSize > maxSize) {
      req.destroy();
      return res.status(413).json({
        error: 'File too large',
        maxSize: `${maxSize / 1024 / 1024}MB`,
      });
    }

    // Send progress update (optional)
    if (uploadedSize % (1024 * 1024) === 0) {
      // Every MB
      const progress = (uploadedSize / maxSize) * 100;
      console.log(`Upload progress: ${progress.toFixed(1)}%`);
    }
  });

  req.on('end', () => {
    // Process completed upload
    const file = req.file();

    res.json({
      success: true,
      file: {
        size: uploadedSize,
        filename: file.filename,
      },
    });
  });

  req.on('error', (error) => {
    res.status(400).json({ error: 'Upload failed' });
  });
});
```

### Memory Management

```typescript
// Configure body parser for memory optimization
app.configure({
  bodyParser: {
    json: {
      limit: '10mb', // JSON size limit
      strict: true, // Strict JSON parsing
    },
    urlencoded: {
      limit: '10mb', // Form data limit
      extended: true, // Extended URL encoding
    },
    multipart: {
      limit: '50mb', // File upload limit
      fileLimit: 10, // Max number of files
      memoryLimit: '20mb', // Memory usage limit
      tempDir: '/tmp/uploads', // Temporary directory
      keepExtensions: true, // Keep file extensions
    },
    raw: {
      limit: '5mb', // Raw body limit
    },
  },
});
```

## Testing File Uploads

```typescript
// Test file upload functionality
import { createApp } from 'nextrush';
import request from 'supertest';
import fs from 'fs';
import path from 'path';

describe('File Uploads', () => {
  let app;

  beforeEach(() => {
    app = createApp();

    app.post('/test-upload', (req, res) => {
      const file = req.file('testFile');
      res.json({
        hasFile: !!file,
        filename: file?.filename,
        size: file?.size,
        mimetype: file?.mimetype,
      });
    });
  });

  test('handles single file upload', async () => {
    // Create test file
    const testFile = Buffer.from('test file content');

    const response = await request(app)
      .post('/test-upload')
      .attach('testFile', testFile, 'test.txt')
      .expect(200);

    expect(response.body.hasFile).toBe(true);
    expect(response.body.filename).toBe('test.txt');
    expect(response.body.mimetype).toBe('text/plain');
  });

  test('handles form data with file', async () => {
    const response = await request(app)
      .post('/test-upload')
      .field('name', 'John Doe')
      .field('email', 'john@example.com')
      .attach('testFile', Buffer.from('content'), 'document.txt')
      .expect(200);

    expect(response.body.hasFile).toBe(true);
  });

  test('rejects files that are too large', async () => {
    // Create large buffer (simulate large file)
    const largeFile = Buffer.alloc(20 * 1024 * 1024); // 20MB

    const response = await request(app)
      .post('/test-upload')
      .attach('testFile', largeFile, 'large.txt');

    expect(response.status).toBe(413); // Payload too large
  });
});
```
