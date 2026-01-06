import { createApp, createRouter, serve, listen } from 'nextrush';


function main() {

  const app = createApp();
  const router = createRouter();

  const port = 3000;


  router.get('/hello', ctx => {
    
    ctx.json({ message: 'Hello, World!' })
  })



  app.route('/', router)


  listen(app, 4444);

  serve(app, {
    port,
    onListen: () => {
      console.log(`Server is running at http://localhost:${port}`);
    },
    onError: (err) => {
      console.error('Server error:', err);
    }
  })


}

main();
