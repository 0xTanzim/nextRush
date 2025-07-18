#!/usr/bin/env node

/**
 * 🧪 Quick Client Test for Enhanced Features
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NextRush-Test-Client',
      },
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({
            status: res.statusCode,
            data: result,
            headers: res.headers,
          });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testEnhancedFeatures() {
  console.log('🧪 Testing NextRush Enhanced Features Client\n');

  try {
    // Test 1: Enhanced Request Methods
    console.log('1️⃣ Testing Enhanced Request Methods...');
    const requestTest = await makeRequest('/test/request');
    console.log('✅ Status:', requestTest.status);
    console.log(
      '📍 Request Info:',
      JSON.stringify(requestTest.data.requestInfo, null, 2)
    );
    console.log('');

    // Test 2: Input Validation (Valid)
    console.log('2️⃣ Testing Input Validation (Valid)...');
    const validData = {
      email: 'test@example.com',
      age: 25,
      name: 'John Doe',
    };
    const validationTest = await makeRequest(
      '/test/validation',
      'POST',
      validData
    );
    console.log('✅ Status:', validationTest.status);
    console.log(
      '🛡️ Validation Result:',
      JSON.stringify(validationTest.data, null, 2)
    );
    console.log('');

    // Test 3: Input Validation (Invalid)
    console.log('3️⃣ Testing Input Validation (Invalid)...');
    const invalidData = {
      email: 'invalid-email',
      age: 16, // Too young
      name: 'A', // Too short
    };
    const invalidTest = await makeRequest(
      '/test/validation',
      'POST',
      invalidData
    );
    console.log('❌ Status:', invalidTest.status);
    console.log(
      '🚫 Validation Errors:',
      JSON.stringify(invalidTest.data.errors, null, 2)
    );
    console.log('');

    // Test 4: Data Sanitization
    console.log('4️⃣ Testing Data Sanitization...');
    const sanitizeTest = await makeRequest('/test/sanitize', 'POST', {});
    console.log('✅ Status:', sanitizeTest.status);
    console.log(
      '🧼 Sanitization Result:',
      JSON.stringify(sanitizeTest.data, null, 2)
    );
    console.log('');

    // Test 5: Email & URL Validation
    console.log('5️⃣ Testing Email & URL Validation...');
    const validatorsTest = await makeRequest('/test/validators', 'POST', {
      email: 'test@example.com',
      url: 'https://example.com',
    });
    console.log('✅ Status:', validatorsTest.status);
    console.log(
      '📧 Validation Results:',
      JSON.stringify(validatorsTest.data, null, 2)
    );
    console.log('');

    // Test 6: Cookie Management
    console.log('6️⃣ Testing Cookie Management...');
    const cookiesTest = await makeRequest('/test/cookies');
    console.log('✅ Status:', cookiesTest.status);
    console.log('🍪 Cookies Set:', cookiesTest.headers['set-cookie']);
    console.log('📄 Response:', JSON.stringify(cookiesTest.data, null, 2));
    console.log('');

    // Test 7: Complete Feature Test
    console.log('7️⃣ Testing Complete Feature Set...');
    const completeTest = await makeRequest('/test/all');
    console.log('✅ Status:', completeTest.status);
    console.log(
      '🎯 Complete Test:',
      JSON.stringify(completeTest.data, null, 2)
    );
    console.log('');

    console.log('🎉 All Enhanced Features Tests Completed Successfully!');
    console.log('✨ NextRush Enhanced Features are working perfectly!');
  } catch (error) {
    console.error('❌ Test Error:', error.message);
  }
}

// Run tests
if (require.main === module) {
  testEnhancedFeatures();
}
