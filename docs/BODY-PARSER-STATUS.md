# NextRush Body Parser API

## 🚀 **Current Implementation Status**

### ✅ **What's Working**

- ✅ **JSON Parsing** - Complete with validation
- ✅ **URL-encoded Forms** - Standard form data parsing
- ✅ **Text/Raw Body** - Plain text body parsing
- ✅ **Size Limits** - Configurable payload limits
- ✅ **Timeout Support** - Request timeout handling
- ✅ **Content-Type Validation** - Automatic type detection

### ❌ **What's Missing (Critical Features)**

- ❌ **Multipart/Form-data** - File upload parsing
- ❌ **File Upload API** - `req.files`, `req.file()` methods
- ❌ **Streaming Parser** - Large file upload streaming
- ❌ **File Validation** - MIME type and size validation
- ❌ **Upload Progress** - Progress tracking

## 📋 **Current Body Parser Features**

### JSON Request Parsing

```typescript
app.post('/api/data', (req, res) => {
  // ✅ This works - JSON body parsing
  const { name, email, age } = req.body;

  // ✅ Body is automatically parsed and validated
  res.json({ received: req.body });
});
```

### URL-encoded Form Parsing

```typescript
app.post('/form', (req, res) => {
  // ✅ This works - Form data parsing
  const { username, password } = req.body;

  res.json({ user: username });
});
```

### Text/Raw Body Parsing

```typescript
app.post('/webhook', (req, res) => {
  // ✅ This works - Raw text body
  const rawData = req.body; // String content

  res.send('Webhook received');
});
```

### Configuration

```typescript
import { BodyParser } from '@nextrush/core';

// Configure body parser limits
const bodyParser = new BodyParser({
  maxSize: 10 * 1024 * 1024, // 10MB limit
  timeout: 30000, // 30 second timeout
  allowedContentTypes: [
    'application/json',
    'application/x-www-form-urlencoded',
    'text/plain',
  ],
  strict: true, // Strict content-type checking
});
```

## ❌ **Missing File Upload Features**

### What Should Work (But Doesn't Yet)

```typescript
// ❌ THIS DOESN'T WORK YET - NEEDS IMPLEMENTATION
app.post('/upload', (req, res) => {
  // File upload parsing - NOT IMPLEMENTED
  const { files, fields } = req.body; // ❌ No multipart parsing
  const avatar = req.file('avatar'); // ❌ Method doesn't exist
  const documents = req.files.documents; // ❌ Property doesn't exist

  // Direct access methods - NOT IMPLEMENTED
  const profileImage = req.file('profile'); // ❌ Single file access
  const allFiles = req.files; // ❌ All uploaded files

  // File validation - NOT IMPLEMENTED
  if (avatar.mimetype !== 'image/jpeg') {
    // ❌ No file validation
    return res.status(400).send('Invalid file type');
  }

  // File information - NOT IMPLEMENTED
  console.log({
    filename: avatar.filename, // ❌ Original filename
    mimetype: avatar.mimetype, // ❌ MIME type
    size: avatar.size, // ❌ File size
    buffer: avatar.buffer, // ❌ File buffer/data
  });
});
```

## 🔥 **Required Implementation**

### 1. Multipart Form Parser

```typescript
// Need to implement multipart/form-data parsing
interface MultipartParser {
  parse(request: IncomingMessage): Promise<{
    fields: Record<string, string>;
    files: Record<string, FileUpload[]>;
  }>;
}

interface FileUpload {
  filename: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  fieldname: string;
}
```

### 2. Enhanced Request Interface

```typescript
// Need to add to NextRushRequest interface
interface NextRushRequest {
  // Current working properties
  body: any; // ✅ Working

  // Missing file upload properties
  files: Record<string, FileUpload[]>; // ❌ Not implemented
  file(fieldname: string): FileUpload; // ❌ Not implemented

  // Missing body type methods
  json(): any; // ❌ Not implemented
  text(): string; // ❌ Not implemented
  raw(): Buffer; // ❌ Not implemented
}
```

### 3. File Validation

```typescript
// Need file upload validation
interface FileValidationOptions {
  allowedMimeTypes?: string[];
  maxFileSize?: number;
  minFileSize?: number;
  allowedExtensions?: string[];
  requireFileSize?: boolean;
}
```

## 📊 **Implementation Priority**

### **Phase 1: Core Multipart Parsing (Critical)**

1. **Multipart Form Parser** - Parse multipart/form-data requests
2. **File Buffer Handling** - Store uploaded files in memory/disk
3. **Field Extraction** - Separate form fields from files
4. **Basic File Properties** - filename, mimetype, size

### **Phase 2: Request API Enhancement (High)**

1. **req.files Property** - Access to all uploaded files
2. **req.file() Method** - Access single file by field name
3. **Body Type Methods** - req.json(), req.text(), req.raw()
4. **File Validation** - MIME type and size validation

### **Phase 3: Advanced Features (Medium)**

1. **Streaming Uploads** - Handle large file uploads efficiently
2. **Upload Progress** - Track upload progress
3. **Temporary File Storage** - Disk-based file storage
4. **File Cleanup** - Automatic cleanup of uploaded files

### **Phase 4: Security & Performance (Low)**

1. **File Virus Scanning** - Scan uploaded files
2. **Image Processing** - Resize/optimize images
3. **Cloud Storage Integration** - Direct upload to S3/etc
4. **Advanced Validation** - Custom file validation

## 🧪 **Testing Current Implementation**

```typescript
// Test what currently works
import NextRush from '@nextrush/core';

const app = new NextRush();

// ✅ JSON parsing test
app.post('/test-json', (req, res) => {
  console.log('JSON body:', req.body);
  res.json({ received: req.body });
});

// ✅ Form data test
app.post('/test-form', (req, res) => {
  console.log('Form data:', req.body);
  res.json({ received: req.body });
});

// ❌ File upload test (will fail)
app.post('/test-upload', (req, res) => {
  try {
    console.log('Files:', req.files); // ❌ Undefined
    console.log('Body:', req.body); // ✅ Works for non-file fields

    res.json({
      files: req.files || 'Not implemented',
      body: req.body,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

## 🎯 **Developer Expectations vs Reality**

### **What Developers Expect (Express.js-like)**

```typescript
// Standard Express.js file upload with multer
app.post('/upload', upload.single('avatar'), (req, res) => {
  console.log(req.file); // File information
  console.log(req.body); // Form fields
});
```

### **What NextRush Should Provide**

```typescript
// NextRush built-in file upload (when implemented)
app.post('/upload', (req, res) => {
  const avatar = req.file('avatar'); // Single file
  const documents = req.files.documents; // Multiple files
  const { title, description } = req.body; // Form fields
});
```

### **Current NextRush Reality**

```typescript
// What actually works in NextRush now
app.post('/upload', (req, res) => {
  console.log(req.body); // ✅ Works for JSON/form data
  console.log(req.files); // ❌ undefined (not implemented)
  console.log(req.file); // ❌ undefined (not implemented)
});
```

## 🚨 **Critical Missing Features Summary**

1. **Multipart Form Parsing** - Core file upload functionality
2. **File Access API** - req.files, req.file() methods
3. **File Validation** - Security and type checking
4. **Body Type Methods** - req.json(), req.text(), req.raw()
5. **Streaming Uploads** - Large file handling
6. **File Information** - Filename, MIME type, size
7. **Field Separation** - Distinguish files from form fields

## 📝 **Implementation Notes**

The current body parser handles JSON and URL-encoded data perfectly, but lacks the critical multipart/form-data parsing needed for file uploads. This is essential for any modern web application that needs file upload functionality.

**Without file upload support, NextRush cannot be considered production-ready for most web applications.**

---

**Status: Body parser is 70% complete. File upload support is the #1 missing feature.**
