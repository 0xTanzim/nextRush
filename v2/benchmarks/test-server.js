const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Hello World', timestamp: Date.now() }));
});

server.listen(0, () => {
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);
  
  // Run Apache Bench test
  const { spawn } = require('child_process');
  const ab = spawn('ab', [
    '-n', '100',
    '-c', '10',
    '-k',
    `http://localhost:${port}/`
  ]);
  
  let output = '';
  ab.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  ab.stderr.on('data', (data) => {
    console.error(`Apache Bench stderr: ${data}`);
  });
  
  ab.on('close', (code) => {
    console.log('Apache Bench output:');
    console.log(output);
    console.log(`Apache Bench exited with code ${code}`);
    server.close();
    process.exit(code);
  });
});
