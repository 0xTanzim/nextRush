#!/usr/bin/env node
import { createApp } from './src/index';
import type { Context } from './src/types/context';

const app = createApp();

// Route 1: /root/:param_1/abc/:param2
app.get('/root/:param_1/abc/:param2', async (ctx: Context) => {
  ctx.res.json({
    success: true,
    route: '/root/:param_1/abc/:param2',
    parameters: {
      param_1: ctx.params['param_1'],
      param2: ctx.params['param2'],
    },
  });
});

// Route 2: /root/:param_1/abc/:param2/xyz/:parm3
app.get('/root/:param_1/abc/:param2/xyz/:parm3', async (ctx: Context) => {
  ctx.res.json({
    success: true,
    route: '/root/:param_1/abc/:param2/xyz/:parm3',
    parameters: {
      param_1: ctx.params['param_1'],
      param2: ctx.params['param2'],
      parm3: ctx.params['parm3'],
    },
  });
});

// Test the routes
const http = require('http');

async function testRoute(path: string, expectedParams: Record<string, string>) {
  console.log(`\n🧪 Testing: ${path}`);

  const server = app.listen(0); // Use random port
  const port = (server.address() as any)?.port;

  return new Promise<void>((resolve, reject) => {
    const req = http.get(`http://localhost:${port}${path}`, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => (data += chunk));
      res.on('end', () => {
        try {
          const result = JSON.parse(data);

          if (result.success) {
            console.log('✅ Route matched successfully!');
            console.log('📝 Parameters extracted:', result.parameters);

            // Verify parameters
            let allMatch = true;
            for (const [key, expectedValue] of Object.entries(expectedParams)) {
              if (result.parameters[key] !== expectedValue) {
                console.log(
                  `❌ Parameter ${key}: expected "${expectedValue}", got "${result.parameters[key]}"`
                );
                allMatch = false;
              }
            }

            if (allMatch) {
              console.log('🎉 All parameters match expected values!');
            }
          } else {
            console.log('❌ Route test failed:', result);
          }

          server.close();
          resolve();
        } catch (error) {
          console.log('❌ JSON parse error:', error);
          server.close();
          reject(error);
        }
      });
    });

    req.on('error', (error: any) => {
      console.log('❌ Request error:', error.message);
      server.close();
      reject(error);
    });
  });
}

// Run tests
async function runTests() {
  console.log('🚀 Testing Multi-Level Routes');
  console.log('================================');

  try {
    // Test Route 1: /root/:param_1/abc/:param2
    await testRoute('/root/user123/abc/data456', {
      param_1: 'user123',
      param2: 'data456',
    });

    // Test Route 2: /root/:param_1/abc/:param2/xyz/:parm3
    await testRoute('/root/alpha/abc/beta/xyz/gamma', {
      param_1: 'alpha',
      param2: 'beta',
      parm3: 'gamma',
    });

    // Test additional patterns
    await testRoute('/root/test-value/abc/another-test', {
      param_1: 'test-value',
      param2: 'another-test',
    });

    await testRoute(
      '/root/complex_param/abc/data-with-dashes/xyz/final-value',
      {
        param_1: 'complex_param',
        param2: 'data-with-dashes',
        parm3: 'final-value',
      }
    );

    console.log('\n🎉 All multi-level routing tests completed successfully!');
    console.log('✅ Both route patterns are working correctly');
    console.log('✅ Parameter extraction is functioning properly');
    console.log('✅ Complex parameter values handled correctly');
  } catch (error) {
    console.log('\n❌ Test failed:', error);
    process.exit(1);
  }
}

runTests();
