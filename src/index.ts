import { Zestfx } from './Zestfx';

const app = new Zestfx();

app.get('/', (req, res) => {
  res.send('Welcome to Home!!!');
});

app.post('/user', (req, res) => {
  res.json({ received: req.body }, 201);
});

app.get('/text', (req, res) => {
  res.send('Hello world as text!', 200, 'text/plain');
});

app.get('/file', async (req, res) => {
  await res.serveHtmlFile('./index.html', 200);
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
