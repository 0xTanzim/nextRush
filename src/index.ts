import { MyExpress } from './MyExpress';

const app = new MyExpress();

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.end('Welcome to Home!!!');
});

app.post('/user', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ received: req.body }));
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
