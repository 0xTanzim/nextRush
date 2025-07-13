// This file demonstrates the improved IntelliSense behavior
import { Zestfx } from './src/Zestfx';

const app = new Zestfx();

// Example showing that after calling response-ending methods,
// TypeScript knows the response is finished
app.get('/test', async (req, res) => {
  // Before calling json(), res has all methods available
  res.status(200); // ✅ This works

  const finished = res.json({ message: 'Hello' }); // This ends the response

  // After calling json(), finished is a FinishedResponse
  // You shouldn't be able to call more methods on it
  // finished.json(); // This would be wrong - response already sent!

  // You can still access properties but not call ending methods again
  console.log('Response finished:', finished.statusCode);
});

app.get('/test-file', async (req, res) => {
  // Before serving file
  res.status(200); // ✅ This works

  const finished = await res.serveHtmlFile('./index.html'); // This ends the response

  // After serving file, the response is finished
  // finished.send('more data'); // This would be wrong!

  console.log('File served, status:', finished.statusCode);
});

// Example showing proper chaining with status
app.get('/test-chain', (req, res) => {
  // You can chain status with ending methods
  res.status(201).json({ created: true }); // ✅ This works perfectly

  // But you can't do anything after the ending method
  // res.send('more'); // This won't work because response is already ended
});

export { app };
